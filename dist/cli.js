"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const ws_1 = __importDefault(require("ws"));
const yargs_1 = __importDefault(require("yargs"));
const fs_1 = __importDefault(require("fs"));
const process_1 = require("process");
const argv = yargs_1.default
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
const server = argv.server || "ws://localhost:8080";
const file = argv.file || "default.json";
function main() {
    return __awaiter(this, void 0, void 0, function* () {
        console.log("Parsing file: " + file);
        const [type, payload] = yield loadQuery();
        console.log("Connecting to server: " + server);
        const ws = new ws_1.default(server);
        ws.onopen = () => {
            console.log("Connected...");
            sendQuery(ws, type, payload);
        };
        ws.onmessage = (event) => {
            console.log("<" + event.data + "\n");
            var parsed = JSON.parse(event.data);
            if (parsed[0] == "EOSE") {
                console.log("Closing connection...");
                sendQuery(ws, "CLOSE", "");
                ws.close();
                process_1.exit;
            }
        };
        ws.onclose = () => {
            console.log("Disconnected from server");
        };
    });
}
main();
// Function to load the query from a file async so the main function can wait for it. It shall return a tuple of the content.type and the content.payload
function loadQuery() {
    return __awaiter(this, void 0, void 0, function* () {
        return new Promise((resolve, reject) => {
            fs_1.default.readFile(file, "utf8", (err, data) => {
                if (err) {
                    reject(err);
                }
                else {
                    const content = JSON.parse(data);
                    resolve([content.type, content.payload]);
                }
            });
        });
    });
}
function sendQuery(ws, type, payload) {
    var msg;
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
