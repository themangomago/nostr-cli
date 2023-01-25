# Super Tiny Nostr CLI

nostr cli that parses a provided json file to query a given nostr relay. Useful for testing and manually push data to nostr.

## Build
  
  Windows:

  ```bash
  npm install
  npm run build
  ```

  Linux:

  ```bash
  npm install
  npm run build_linux
  ```

## Usage

Create json files for the queries to be made:

  ```json
  {
    "type": "REQ",
    "payload": {
        "authors": ["df50f3108b22fade9b59f5ca664604166ad78428fb221aebf360dbb8051a997d"]
    }
  }
  ```

Call nostrcli:
  
    ```bash
    nostrcli -f <file> -r <relay>
    ```

By default the relay is set to `http://localhost:8080` and the file is set to `query.json`.