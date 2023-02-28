# Simple Nostr CLI

A nostr cli to post and make requests to a nostr relay by parsing json files.


## Build
  
  Windows:

  ```bash
  npm install
  npm run build_win
  ```

  Linux:

  ```bash
  npm install
  npm run build_linux
  ```

## Usage

### Parameters

- `-t` or `--type` - Type of the request. Can be `event` or `req`.
- `-f` or `--file` - Path to the json file.
- `-r` or `--relay` - Url to the relay.
- `-k` or `--key` - Private key to sign the message.
- `-s` or `--silent` - Don't show the output.
- `-o` or `--output` - Path to the output file (optional).
- `-h` or `--help` - Show help.


### Posting a message
```json
{
  "content": "hello world",
  "created_at": 0,
  "id": "",
  "kind": 1,
  "pubkey": "",
  "sig": "",
  "tags": []
}
```

Missing informations will be filled with valid data by the cli. 

```bash
nostrcli -t="event" -f=<file> -r=<relay>
nostrcli -t="event" -f="query.json" -r="ws://127.0.0.1:8080"
```

### Making a request

```json
{
  "authors": [
    "29dd45962daff2248a97456bc0b57369e2aae84b42613fc7e53ac4a5de5c3198"
  ]
}
```

```bash
nostrcli -t="req" -f=<file> -r=<relay>
nostrcli -t="req" -f="query.json" -r="ws://127.0.0.1:8080"
```
Valid query parameters:
- ids: string[]
- kinds: number[]
- authors: string[]
- since: number
- until: number
- limit: number
- #<string>: string[]

## License
[MIT](https://choosealicense.com/licenses/mit/)

## Contact

npub1mag0xyytytadax6e7h9xv3syze4d0ppglv3p46lnvrdmspg6n97sjplrzm
