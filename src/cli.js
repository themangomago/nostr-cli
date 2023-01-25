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
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
exports.__esModule = true;
var nostr_tools_1 = require("nostr-tools");
require("websocket-polyfill");
var yargs_1 = require("yargs");
var argv = yargs_1["default"]
    .option("type", {
    type: "string",
    demandOption: true,
    describe: "Query type: REQ, EVENT, CLOSE"
})
    .option("payload", {
    type: "string",
    demandOption: true,
    describe: "Payload of the request"
})
    .option("server", {
    type: "string",
    demandOption: true,
    describe: "Server URL"
})
    .help()
    .parseSync();
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var callback;
        var _this = this;
        return __generator(this, function (_a) {
            callback = function () { return __awaiter(_this, void 0, void 0, function () {
                var relay, event, post;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            relay = (0, nostr_tools_1.relayInit)("ws://localhost:8080");
                            //var relay = relayInit("wss://nostr-pub.wellorder.net");
                            return [4 /*yield*/, relay.connect()["catch"](function (e) {
                                    console.log("Failed connecting to: ", relay.url);
                                })];
                        case 1:
                            //var relay = relayInit("wss://nostr-pub.wellorder.net");
                            _a.sent();
                            event = {
                                id: "e3453dd0fc951623bfa17f51a4d08402e0482c410983a6ce73cd28f91c678e28",
                                sig: "b16a0d55f31b3764308821138e7282ea50a5db2a84b3edccf435411cff7a0435e4f331b4931239adb624d9cf892cb29534547dbe568a67eb386dc43ccbdcbb51",
                                kind: 1,
                                tags: [],
                                pubkey: "df50f3108b22fade9b59f5ca664604166ad78428fb221aebf360dbb8051a997d",
                                content: "Does anyone need help with a nostr project?",
                                created_at: 1674243368
                            };
                            post = relay.publish(event);
                            post.on("ok", function () {
                                console.log("Post OK");
                            });
                            post.on("failed", function (reason) {
                                console.log("Post Failed: ", reason);
                            });
                            return [2 /*return*/];
                    }
                });
            }); };
            callback();
            // interval every 10 seconds
            setInterval(callback, 20000);
            return [2 /*return*/];
        });
    });
}
main();
