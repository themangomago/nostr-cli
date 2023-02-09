import yargs from "yargs";
import fs from "fs";
import "websocket-polyfill";

import {
  validateEvent,
  verifySignature,
  signEvent,
  getEventHash,
  getPublicKey,
  relayInit,
} from "nostr-tools";
import { Event } from "nostr-tools/event";
import { Filter } from "nostr-tools/filter";

const argv = yargs
  .option("file", {
    type: "string",
    describe: "Query file in json format.",
    default: "query.json",
  })
  .option("type", {
    type: "string",
    describe: "File type: 'req' or 'event'.",
    default: "req",
  })
  .option("relay", {
    type: "string",
    describe: "Server URL",
    default: "ws://127.0.0.1:8080",
  })
  .option("key", {
    type: "string",
    describe: "Private key to sign the event",
    default: "fc9f8fd273d21eab275f780b27bd8a03997334678a7d6550b0a368b026630d7b",
  })
  .option("output", {
    type: "string",
    describe: "Output file",
    default: "",
  })
  .option("silent", {
    type: "boolean",
    describe: "Silent mode, no output",
    default: false,
  })
  .alias("f", "file")
  .alias("t", "type")
  .alias("r", "relay")
  .alias("k", "key")
  .alias("s", "silent")
  .alias("o", "output")
  .help()
  .parseSync();

const file: string = argv.file;
const type: string = argv.type;
const server: string = argv.relay;
const key: string = argv.key;
const silent: boolean = argv.silent;
const output: string = argv.output;

async function main() {
  if (!silent) {
    console.log(
      "-[NostrCli]-------------------------------------------------------------"
    );
    console.log("Relay: " + server);
    console.log("Key: " + key);
    console.log("File: " + file);
    console.log("Type: " + type);
    console.log(
      "------------------------------------------------------------------------"
    );
  }

  const query = await loadFile().catch((err) => {
    console.error("Could not load file: " + file);
    console.error(
      "The file does either not exist or is not a valid json file."
    );
    process.exit();
  });

  try {
    switch (type) {
      case "event":
        performEvent(query);
        break;
      case "req":
        performReq(query);
        break;
      default:
        console.error(`Unknown type: ${type}`);
        process.exit();
    }
  } catch (err) {
    console.error("Error: " + err);
    process.exit();
  }

  return;
}
main();

async function performEvent(query: object): Promise<string> {
  return new Promise(async (resolve, reject) => {
    // Check if all required properties are present
    const requiredProperties = [
      "pubkey",
      "created_at",
      "kind",
      "tags",
      "content",
    ];
    if (!requiredProperties.every((prop) => prop in query)) {
      reject("Missing properties in the provided file: " + file);
      return;
    }

    // Now we can cast to Event
    var query_event: Event = query as Event;

    // Optionals properties we need to generate if not exist
    if (query_event.created_at == 0) {
      query_event.created_at = Math.floor(Date.now() / 1000);
    }
    if (query_event.pubkey === "" || query_event.pubkey.length < 64) {
      query_event.pubkey = getPublicKey(key);
    }
    if (
      !query_event.id ||
      query_event.id === "" ||
      query_event.id.length < 64
    ) {
      query_event.id = getEventHash(query_event);
    }
    if (
      !query_event.sig ||
      query_event.sig === "" ||
      query_event.sig.length < 128
    ) {
      query_event.sig = signEvent(query_event, key);
    }

    // Event validation
    var validation = validateEvent(query_event);
    var verification = verifySignature(query_event as Event & { sig: string });

    if (!validation || !verification) {
      reject(
        "Data validation or verification error.\nValidation: " +
          validation +
          "\nVerification: " +
          verification
      );
      return;
    }

    var relay = relayInit(server);
    await relay.connect().catch((e: any) => {
      reject("Failed to connect to relay: " + server);
    });
    if (!silent) {
      console.log("Connected..");
    }
    try {
      if (!silent) {
        console.log("Publishing event..");
      }
      var pub = relay.publish(query_event);
      pub.on("ok", () => {
        console.log("Event published. Bye!");
        process.exit();
      });
      pub.on("seen", () => {
        console.log("Event seen on relay.");
      });
      pub.on("failed", (reason: any) => {
        console.error("Failed to publish event: " + reason);
        process.exit();
      });
    } catch (e: any) {
      reject("Failed to publish event.");
    }

    resolve("Ok");
  });
}

async function performReq(query: object): Promise<string> {
  return new Promise(async (resolve, reject) => {
    var filter: Filter = query as Filter;

    var relay = relayInit(server);
    await relay.connect().catch((e: any) => {
      reject("Failed to connect to relay: " + server);
    });
    if (!silent) {
      console.log("Connected..");
    }
    try {
      var log: Event[] = [];
      if (!silent) {
        console.log("-- Requesting --");
      }
      var sub = relay.sub([filter]);
      sub.on("event", (event: Event) => {
        if (!silent) {
          if (output === "") {
            console.log(event);
          } else {
            console.log("Event received.");
          }
        }
        log.push(event);
      });
      sub.on("eose", () => {
        sub.unsub();
        if (!silent) {
          console.log("-- End of stream -- ");
        }

        if (output !== "") {
          storeEventJson(log)
            .catch((err) => {
              console.error(err);
              process.exit();
            })
            .then(() => {
              console.log("Events stored in: " + output);
              process.exit();
            });
        } else {
          // No output file, just exit
          process.exit();
        }
      });
    } catch (e: any) {
      reject("Failed to request events.");
    }

    resolve("Req Ok");
  });
}

async function storeEventJson(event: Event[]): Promise<void> {
  return new Promise(async (resolve, reject) => {
    await fs.writeFile(output, JSON.stringify(event), (err) => {
      if (err) {
        reject("Failed to write to file: " + output);
      } else {
        resolve();
      }
    });
  });
}

async function loadFile(): Promise<object> {
  return new Promise((resolve, reject) => {
    fs.readFile(file, "utf8", (err, data) => {
      if (err) {
        reject(err);
      } else {
        try {
          const jsonData = JSON.parse(data);
          resolve(jsonData);
        } catch (err) {
          reject(err);
        }
      }
    });
  });
}
