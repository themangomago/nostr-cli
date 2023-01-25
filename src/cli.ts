import WebSocket from "ws";
import yargs from "yargs";
import fs from "fs";
import { exit } from "process";

const argv = yargs
  .option("file", {
    type: "string",
    demandOption: true,
    describe: "Query file in json format",
  })
  .option("server", {
    type: "string",
    describe: "Server URL",
  })
  .alias("f", "file")
  .help()
  .parseSync();

const server: string = argv.server || "ws://localhost:8080";
const file: string = argv.file || "query.json";

async function main() {
  console.log("Parsing file: " + file);
  const [type, payload] = await loadQuery();

  console.log("Connecting to server: " + server);
  const ws = new WebSocket(server);

  ws.onopen = () => {
    console.log("Connected...");
    sendQuery(ws, type, payload);
  };

  ws.onmessage = (event: any) => {
    console.log("<" + event.data + "\n");

    var parsed = JSON.parse(event.data);
    if (parsed[0] == "EOSE") {
      console.log("Closing connection...");
      sendQuery(ws, "CLOSE", "");
      ws.close();
      exit;
    }
  };

  ws.onclose = () => {
    console.log("Disconnected from server");
  };
}
main();

// Function to load the query from a file async so the main function can wait for it. It shall return a tuple of the content.type and the content.payload
async function loadQuery(): Promise<[string, string]> {
  return new Promise((resolve, reject) => {
    fs.readFile(file, "utf8", (err, data) => {
      if (err) {
        reject(err);
      } else {
        const content = JSON.parse(data);
        resolve([content.type, content.payload]);
      }
    });
  });
}

function sendQuery(ws: WebSocket, type: string, payload: string) {
  var msg: String;

  switch (type) {
    case "REQ":
      msg = JSON.stringify(["REQ", "1337", payload]);
      break;
    case "EVENT":
      msg = JSON.stringify([type, payload]);
      break;
    case "CLOSE":
      msg = JSON.stringify([type, "1337"]);
      break;
    default:
      console.log("Unknown request: " + type);
      return;
  }
  console.log(">" + msg);
  ws.send(msg);
}
