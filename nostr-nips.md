## NIPS from the Nostr Protocol GitHub repository

This file was generated on 2023-02-05 16:54:02.



---

NIP-01
======

Basic protocol flow description
-------------------------------

`draft` `mandatory` `author:fiatjaf` `author:distbit` `author:scsibug` `author:kukks` `author:jb55`

This NIP defines the basic protocol that should be implemented by everybody. New NIPs may add new optional (or mandatory) fields and messages and features to the structures and flows described here.

## Events and signatures

Each user has a keypair. Signatures, public key, and encodings are done according to the [Schnorr signatures standard for the curve `secp256k1`](https://bips.xyz/340).

The only object type that exists is the `event`, which has the following format on the wire:

```json
{
  "id": <32-bytes lowercase hex-encoded sha256 of the the serialized event data>
  "pubkey": <32-bytes lowercase hex-encoded public key of the event creator>,
  "created_at": <unix timestamp in seconds>,
  "kind": <integer>,
  "tags": [
    ["e", <32-bytes hex of the id of another event>, <recommended relay URL>],
    ["p", <32-bytes hex of the key>, <recommended relay URL>],
    ... // other kinds of tags may be included later
  ],
  "content": <arbitrary string>,
  "sig": <64-bytes signature of the sha256 hash of the serialized event data, which is the same as the "id" field>
}
```

To obtain the `event.id`, we `sha256` the serialized event. The serialization is done over the UTF-8 JSON-serialized string (with no white space or line breaks) of the following structure:

```json
[
  0,
  <pubkey, as a (lowercase) hex string>,
  <created_at, as a number>,
  <kind, as a number>,
  <tags, as an array of arrays of non-null strings>,
  <content, as a string>
]
```

## Communication between clients and relays

Relays expose a websocket endpoint to which clients can connect.

### From client to relay: sending events and creating subscriptions

Clients can send 3 types of messages, which must be JSON arrays, according to the following patterns:

  * `["EVENT", <event JSON as defined above>]`, used to publish events.
  * `["REQ", <subscription_id>, <filters JSON>...]`, used to request events and subscribe to new updates.
  * `["CLOSE", <subscription_id>]`, used to stop previous subscriptions.

`<subscription_id>` is a random string that should be used to represent a subscription.

`<filters>` is a JSON object that determines what events will be sent in that subscription, it can have the following attributes:

```json
{
  "ids": <a list of event ids or prefixes>,
  "authors": <a list of pubkeys or prefixes, the pubkey of an event must be one of these>,
  "kinds": <a list of a kind numbers>,
  "#e": <a list of event ids that are referenced in an "e" tag>,
  "#p": <a list of pubkeys that are referenced in a "p" tag>,
  "since": <an integer unix timestamp, events must be newer than this to pass>,
  "until": <an integer unix timestamp, events must be older than this to pass>,
  "limit": <maximum number of events to be returned in the initial query>
}
```

Upon receiving a `REQ` message, the relay SHOULD query its internal database and return events that match the filter, then store that filter and send again all future events it receives to that same websocket until the websocket is closed. The `CLOSE` event is received with the same `<subscription_id>` or a new `REQ` is sent using the same `<subscription_id>`, in which case it should overwrite the previous subscription.

Filter attributes containing lists (such as `ids`, `kinds`, or `#e`) are JSON arrays with one or more values.  At least one of the array's values must match the relevant field in an event for the condition itself to be considered a match.  For scalar event attributes such as `kind`, the attribute from the event must be contained in the filter list.  For tag attributes such as `#e`, where an event may have multiple values, the event and filter condition values must have at least one item in common.

The `ids` and `authors` lists contain lowercase hexadecimal strings, which may either be an exact 64-character match, or a prefix of the event value.  A prefix match is when the filter string is an exact string prefix of the event value.  The use of prefixes allows for more compact filters where a large number of values are queried, and can provide some privacy for clients that may not want to disclose the exact authors or events they are searching for.

All conditions of a filter that are specified must match for an event for it to pass the filter, i.e., multiple conditions are interpreted as `&&` conditions.

A `REQ` message may contain multiple filters. In this case, events that match any of the filters are to be returned, i.e., multiple filters are to be interpreted as `||` conditions.

The `limit` property of a filter is only valid for the initial query and can be ignored afterward. When `limit: n` is present it is assumed that the events returned in the initial query will be the latest `n` events. It is safe to return less events than `limit` specifies, but it is expected that relays do not return (much) more events than requested so clients don't get unnecessarily overwhelmed by data.

### From relay to client: sending events and notices

Relays can send 2 types of messages, which must also be JSON arrays, according to the following patterns:

  * `["EVENT", <subscription_id>, <event JSON as defined above>]`, used to send events requested by clients.
  * `["NOTICE", <message>]`, used to send human-readable error messages or other things to clients.

This NIP defines no rules for how `NOTICE` messages should be sent or treated.

`EVENT` messages MUST be sent only with a subscription ID related to a subscription previously initiated by the client (using the `REQ` message above).

## Basic Event Kinds

  - `0`: `set_metadata`: the `content` is set to a stringified JSON object `{name: <username>, about: <string>, picture: <url, string>}` describing the user who created the event. A relay may delete past `set_metadata` events once it gets a new one for the same pubkey.
  - `1`: `text_note`: the `content` is set to the text content of a note (anything the user wants to say). Non-plaintext notes should instead use kind 1000-10000 as described in [NIP-16](16.md).
  - `2`: `recommend_server`: the `content` is set to the URL (e.g., `wss://somerelay.com`) of a relay the event creator wants to recommend to its followers.

A relay may choose to treat different message kinds differently, and it may or may not choose to have a default way to handle kinds it doesn't know about.

## Other Notes:

- Clients should not open more than one websocket to each relay. One channel can support an unlimited number of subscriptions, so clients should do that.
- The `tags` array can store a tag identifier as the first element of each subarray, plus arbitrary information afterward (always as strings). This NIP defines `"p"` — meaning "pubkey", which points to a pubkey of someone that is referred to in the event —, and `"e"` — meaning "event", which points to the id of an event this event is quoting, replying to or referring to somehow.
- The `<recommended relay URL>` item present on the `"e"` and `"p"` tags is an optional (could be set to `""`) URL of a relay the client could attempt to connect to fetch the tagged event or other events from a tagged profile. It MAY be ignored, but it exists to increase censorship resistance and make the spread of relay addresses more seamless across clients.


---

NIP-02
======

Contact List and Petnames
-------------------------

`final` `optional` `author:fiatjaf` `author:arcbtc`

A special event with kind `3`, meaning "contact list" is defined as having a list of `p` tags, one for each of the followed/known profiles one is following.

Each tag entry should contain the key for the profile, a relay URL where events from that key can be found (can be set to an empty string if not needed), and a local name (or "petname") for that profile (can also be set to an empty string or not provided), i.e., `["p", <32-bytes hex key>, <main relay URL>, <petname>]`. The `content` can be anything and should be ignored.

For example:

```json
{
  "kind": 3,
  "tags": [
    ["p", "91cf9..4e5ca", "wss://alicerelay.com/", "alice"],
    ["p", "14aeb..8dad4", "wss://bobrelay.com/nostr", "bob"],
    ["p", "612ae..e610f", "ws://carolrelay.com/ws", "carol"]
  ],
  "content": "",
  ...other fields
```

Every new contact list that gets published overwrites the past ones, so it should contain all entries. Relays and clients SHOULD delete past contact lists as soon as they receive a new one.

## Uses

### Contact list backup

If one believes a relay will store their events for sufficient time, they can use this kind-3 event to backup their following list and recover on a different device.

### Profile discovery and context augmentation

A client may rely on the kind-3 event to display a list of followed people by profiles one is browsing; make lists of suggestions on who to follow based on the contact lists of other people one might be following or browsing; or show the data in other contexts.

### Relay sharing

A client may publish a full list of contacts with good relays for each of their contacts so other clients may use these to update their internal relay lists if needed, increasing censorship-resistance.

### Petname scheme

The data from these contact lists can be used by clients to construct local ["petname"](http://www.skyhunter.com/marcs/petnames/IntroPetNames.html) tables derived from other people's contact lists. This alleviates the need for global human-readable names. For example:

A user has an internal contact list that says

```json
[
  ["p", "21df6d143fb96c2ec9d63726bf9edc71", "", "erin"]
]
```

And receives two contact lists, one from `21df6d143fb96c2ec9d63726bf9edc71` that says

```json
[
  ["p", "a8bb3d884d5d90b413d9891fe4c4e46d", "", "david"]
]
```

and another from `a8bb3d884d5d90b413d9891fe4c4e46d` that says

```json
[
  ["p", "f57f54057d2a7af0efecc8b0b66f5708", "", "frank"]
]
```

When the user sees `21df6d143fb96c2ec9d63726bf9edc71` the client can show _erin_ instead;
When the user sees `a8bb3d884d5d90b413d9891fe4c4e46d` the client can show _david.erin_ instead;
When the user sees `f57f54057d2a7af0efecc8b0b66f5708` the client can show _frank.david.erin_ instead.


---

NIP-03
======

OpenTimestamps Attestations for Events
--------------------------------------

`draft` `optional` `author:fiatjaf`

When there is an OTS available it MAY be included in the existing event body under the `ots` key:

```
{
  "id": ...,
  "kind": ...,
  ...,
  ...,
  "ots": <base64-encoded OTS file data>
}
```

The _event id_ MUST be used as the raw hash to be included in the OpenTimestamps merkle tree.

The attestation can be either provided by relays automatically (and the OTS binary contents just appended to the events it receives) or by clients themselves when they first upload the event to relays — and used by clients to show that an event is really "at least as old as [OTS date]".


---

NIP-04
======

Encrypted Direct Message
------------------------

`final` `optional` `author:arcbtc`

A special event with kind `4`, meaning "encrypted direct message". It is supposed to have the following attributes:

**`content`** MUST be equal to the base64-encoded, aes-256-cbc encrypted string of anything a user wants to write, encrypted using a shared cipher generated by combining the recipient's public-key with the sender's private-key; this appended by the base64-encoded initialization vector as if it was a querystring parameter named "iv". The format is the following: `"content": "<encrypted_text>?iv=<initialization_vector>"`.

**`tags`** MUST contain an entry identifying the receiver of the message (such that relays may naturally forward this event to them), in the form `["p", "<pubkey, as a hex string>"]`.

**`tags`** MAY contain an entry identifying the previous message in a conversation or a message we are explicitly replying to (such that contextual, more organized conversations may happen), in the form `["e", "<event_id>"]`.

Code sample for generating such an event in JavaScript:

```js
import crypto from 'crypto'
import * as secp from 'noble-secp256k1'

let sharedPoint = secp.getSharedSecret(ourPrivateKey, '02' + theirPublicKey)
let sharedX = sharedPoint.substr(2, 64)

let iv = crypto.randomFillSync(new Uint8Array(16))
var cipher = crypto.createCipheriv(
  'aes-256-cbc',
  Buffer.from(sharedX, 'hex'),
  iv
)
let encryptedMessage = cipher.update(text, 'utf8', 'base64')
encryptedMessage += cipher.final('base64')
let ivBase64 = Buffer.from(iv.buffer).toString('base64')

let event = {
  pubkey: ourPubKey,
  created_at: Math.floor(Date.now() / 1000),
  kind: 4,
  tags: [['p', theirPublicKey]],
  content: encryptedMessage + '?iv=' + ivBase64
}
```


---

NIP-05
======

Mapping Nostr keys to DNS-based internet identifiers
----------------------------------------------------

`final` `optional` `author:fiatjaf` `author:mikedilger`

On events of kind `0` (`set_metadata`) one can specify the key `"nip05"` with an [internet identifier](https://datatracker.ietf.org/doc/html/rfc5322#section-3.4.1) (an email-like address) as the value. Although there is a link to a very liberal "internet identifier" specification above, NIP-05 assumes the `<local-part>` part will be restricted to the characters `a-z0-9-_.`, case insensitive.

Upon seeing that, the client splits the identifier into `<local-part>` and `<domain>` and use these values to make a GET request to `https://<domain>/.well-known/nostr.json?name=<local-part>`.

The result should be a JSON document object with a key `"names"` that should then be a mapping of names to hex formatted public keys. If the public key for the given `<name>` matches the `pubkey` from the `set_metadata` event, the client then concludes that the given pubkey can indeed be referenced by its identifier.

### Example

If a client sees an event like this:

```json
{
  "pubkey": "b0635d6a9851d3aed0cd6c495b282167acf761729078d975fc341b22650b07b9",
  "kind": 0,
  "content": "{\"name\": \"bob\", \"nip05\": \"bob@example.com\"}"
  ...
}
```

It will make a GET request to `https://example.com/.well-known/nostr.json?name=bob` and get back a response that will look like

```json
{
  "names": {
    "bob": "b0635d6a9851d3aed0cd6c495b282167acf761729078d975fc341b22650b07b9"
  }
}
````

or with the **optional** `"relays"` attribute:

```json
{
  "names": {
    "bob": "b0635d6a9851d3aed0cd6c495b282167acf761729078d975fc341b22650b07b9"
  },
  "relays": {
    "b0635d6a9851d3aed0cd6c495b282167acf761729078d975fc341b22650b07b9": [ "wss://relay.example.com", "wss://relay2.example.com" ]
  }
}
````

If the pubkey matches the one given in `"names"` (as in the example above) that means the association is right and the `"nip05"` identifier is valid and can be displayed.

The optional `"relays"` attribute may contain an object with public keys as properties and arrays of relay URLs as values. When present, that can be used to help clients learn in which relays that user may be found. Web servers which serve `/.well-known/nostr.json` files dynamically based on the query string SHOULD also serve the relays data for any name they serve in the same reply when that is available.

## Finding users from their NIP-05 identifier

A client may implement support for finding users' public keys from _internet identifiers_, the flow is the same as above, but reversed: first the client fetches the _well-known_ URL and from there it gets the public key of the user, then it tries to fetch the kind `0` event for that user and check if it has a matching `"nip05"`.

## Notes

### Clients must always follow public keys, not NIP-05 addresses

For example, if after finding that `bob@bob.com` has the public key `abc...def`, the user clicks a button to follow that profile, the client must keep a primary reference to `abc...def`, not `bob@bob.com`. If, for any reason, the address `https://bob.com/.well-known/nostr.json?name=bob` starts returning the public key `1d2...e3f` at any time in the future, the client must not replace `abc...def` in his list of followed profiles for the user (but it should stop displaying "bob@bob.com" for that user, as that will have become an invalid `"nip05"` property).

### Public keys must be in hex format

Keys must be returned in hex format. Keys in NIP-19 `npub` format are are only meant to be used for display in client UIs, not in this NIP.

### User Discovery implementation suggestion

A client can also use this to allow users to search other profiles. If a client has a search box or something like that, a user may be able to type "bob@example.com" there and the client would recognize that and do the proper queries to obtain a pubkey and suggest that to the user.

### Showing just the domain as an identifier

Clients may treat the identifier `_@domain` as the "root" identifier, and choose to display it as just the `<domain>`. For example, if Bob owns `bob.com`, he may not want an identifier like `bob@bob.com` as that is redundant. Instead, Bob can use the identifier `_@bob.com` and expect Nostr clients to show and treat that as just `bob.com` for all purposes.

### Reasoning for the `/.well-known/nostr.json?name=<local-part>` format

By adding the `<local-part>` as a query string instead of as part of the path the protocol can support both dynamic servers that can generate JSON on-demand and static servers with a JSON file in it that may contain multiple names.

### Allowing access from JavaScript apps

JavaScript Nostr apps may be restricted by browser [CORS][] policies that prevent them from accessing `/.well-known/nostr.json` on the user's domain. When CORS prevents JS from loading a resource, the JS program sees it as a network failure identical to the resource not existing, so it is not possible for a pure-JS app to tell the user for certain that the failure was caused by a CORS issue. JS Nostr apps that see network failures requesting `/.well-known/nostr.json` files may want to recommend to users that they check the CORS policy of their servers, e.g.:

```bash
$ curl -sI https://example.com/.well-known/nostr.json?name=bob | grep -i ^Access-Control
Access-Control-Allow-Origin: *
```

Users should ensure that their `/.well-known/nostr.json` is served with the HTTP header `Access-Control-Allow-Origin: *` to ensure it can be validated by pure JS apps running in modern browsers.

[CORS]: https://developer.mozilla.org/en-US/docs/Web/HTTP/CORS

### Security Constraints

The `/.well-known/nostr.json` endpoint MUST NOT return any HTTP redirects.

Fetchers MUST ignore any HTTP redirects given by the `/.well-known/nostr.json` endpoint.


---

NIP-06
======

Basic key derivation from mnemonic seed phrase
----------------------------------------------

`draft` `optional` `author:fiatjaf`

[BIP39](https://bips.xyz/39) is used to generate mnemonic seed words and derive a binary seed from them.

[BIP32](https://bips.xyz/32) is used to derive the path `m/44'/1237'/0'/0/0` (according to the Nostr entry on [SLIP44](https://github.com/satoshilabs/slips/blob/master/slip-0044.md)).

This is the default for a basic, normal, single-key client.

Other types of clients can still get fancy and use other derivation paths for their own other purposes.


---

NIP-07
======

`window.nostr` capability for web browsers
------------------------------------------

`draft` `optional` `author:fiatjaf`

The `window.nostr` object may be made available by web browsers or extensions and websites or web-apps may make use of it after checking its availability.

That object must define the following methods:

```
async window.nostr.getPublicKey(): string // returns a public key as hex
async window.nostr.signEvent(event: Event): Event // takes an event object, adds `id`, `pubkey` and `sig` and returns it
```

Aside from these two basic above, the following functions can also be implemented optionally:
```
async window.nostr.getRelays(): { [url: string]: {read: boolean, write: boolean} } // returns a basic map of relay urls to relay policies
async window.nostr.nip04.encrypt(pubkey, plaintext): string // returns ciphertext and iv as specified in nip-04
async window.nostr.nip04.decrypt(pubkey, ciphertext): string // takes ciphertext and iv as specified in nip-04
```

### Implementation

- [nos2x](https://github.com/fiatjaf/nos2x)
- [Alby](https://getalby.com)
- [Blockcore](https://www.blockcore.net/wallet)
- [nos2x-fox](https://diegogurpegui.com/nos2x-fox/)


---

NIP-08
======

Handling Mentions
-----------------

`final` `optional` `author:fiatjaf` `author:scsibug`

This document standardizes the treatment given by clients of inline mentions of other events and pubkeys inside the content of `text_note`s.

Clients that want to allow tagged mentions they MUST show an autocomplete component or something analogous to that whenever the user starts typing a special key (for example, "@") or presses some button to include a mention etc -- or these clients can come up with other ways to unambiguously differentiate between mentions and normal text.

Once a mention is identified, for example, the pubkey `27866e9d854c78ae625b867eefdfa9580434bc3e675be08d2acb526610d96fbe`, the client MUST add that pubkey to the `.tags` with the tag `p`, then replace its textual reference (inside `.content`) with the notation `#[index]` in which "index" is equal to the 0-based index of the related tag in the tags array.

The same process applies for mentioning event IDs.

A client that receives a `text_note` event with such `#[index]` mentions in its `.content` CAN do a search-and-replace using the actual contents from the `.tags` array with the actual pubkey or event ID that is mentioned, doing any desired context augmentation (for example, linking to the pubkey or showing a preview of the mentioned event contents) it wants in the process.


---

NIP-09
======

Event Deletion
--------------

`draft` `optional` `author:scsibug`

A special event with kind `5`, meaning "deletion" is defined as having a list of one or more `e` tags, each referencing an event the author is requesting to be deleted.

Each tag entry must contain an "e" event id intended for deletion.

The event's `content` field MAY contain a text note describing the reason for the deletion.

For example:

```
{
  "kind": 5,
  "pubkey": <32-bytes hex-encoded public key of the event creator>,
  "tags": [
    ["e", "dcd59..464a2"],
    ["e", "968c5..ad7a4"],
  ],
  "content": "these posts were published by accident",
  ...other fields
}
```

Relays SHOULD delete or stop publishing any referenced events that have an identical `id` as the deletion request.  Clients SHOULD hide or otherwise indicate a deletion status for referenced events.

Relays SHOULD continue to publish/share the deletion events indefinitely, as clients may already have the event that's intended to be deleted. Additionally, clients SHOULD broadcast deletion events to other relays which don't have it.

## Client Usage

Clients MAY choose to fully hide any events that are referenced by valid deletion events.  This includes text notes, direct messages, or other yet-to-be defined event kinds.  Alternatively, they MAY show the event along with an icon or other indication that the author has "disowned" the event.  The `content` field MAY also be used to replace the deleted event's own content, although a user interface should clearly indicate that this is a deletion reason, not the original content.

A client MUST validate that each event `pubkey` referenced in the `e` tag of the deletion request is identical to the deletion request `pubkey`, before hiding or deleting any event.  Relays can not, in general, perform this validation and should not be treated as authoritative.

Clients display the deletion event itself in any way they choose, e.g., not at all, or with a prominent notice.

## Relay Usage

Relays MAY validate that a deletion event only references events that have the same `pubkey` as the deletion itself, however this is not required since relays may not have knowledge of all referenced events.

## Deleting a Deletion

Publishing a deletion event against a deletion has no effect.  Clients and relays are not obliged to support "undelete" functionality.


---

NIP-10
======


On "e" and "p" tags in Text Events (kind 1).
--------------------------------------------

`draft` `optional` `author:unclebobmartin`

## Abstract
This NIP describes how to use "e" and "p" tags in text events, especially those that are replies to other text events.  It helps clients thread the replies into a tree rooted at the original event.

## Positional "e" tags (DEPRECATED)
>This scheme is in common use; but should be considered deprecated.

`["e", <event-id>, <relay-url>]`  as per NIP-01.

Where:

 * `<event-id>` is the id of the event being referenced.
 * `<relay-url>` is the URL of a recommended relay associated with the reference.  Many clients treat this field as optional.
 
**The positions of the "e" tags within the event denote specific meanings as follows**:

 * No "e" tag: <br>
 This event is not a reply to, nor does it refer to, any other event.

 * One "e" tag: <br>
 `["e", <id>]`: The id of the event to which this event is a reply.

 * Two "e" tags:  `["e", <root-id>]`, `["e", <reply-id>]` <br>
 `<root-id>` is the id of the event at the root of the reply chain.  `<reply-id>` is the id of the article to which this event is a reply.  

 * Many "e" tags: `["e", <root-id>]` `["e", <mention-id>]`, ..., `["e", <reply-id>]`<br>
There may be any number of `<mention-ids>`.  These are the ids of events which may, or may not be in the reply chain.  
They are citings from this event.  `root-id` and `reply-id` are as above.

>This scheme is deprecated because it creates ambiguities that are difficult, or impossible to resolve when an event references another but is not a reply.

## Marked "e" tags (PREFERRED)
`["e", <event-id>, <relay-url>, <marker>]`  
	
Where:

 * `<event-id>` is the id of the event being referenced.
 * `<relay-url>` is the URL of a recommended relay associated with the reference.  It is NOT optional.
 * `<marker>` is optional and if present is one of `"reply"`, `"root"`, or `"mention"`

**The order of marked "e" tags is not relevant.**  Those marked with `"reply"` denote the id of the reply event being responded to.  Those marked with `"root"` denote the root id of the reply thread being responded to. For top level replies (those replying directly to the root event), only the `"root"` marker should be used. Those marked with `"mention"` denote a quoted or reposted event id.

A direct reply to the root of a thread should have a single marked "e" tag of type "root".

>This scheme is preferred because it allows events to mention others without confusing them with `<reply-id>` or `<root-id>`.  


## The "p" tag
Used in a text event contains a list of pubkeys used to record who is involved in a reply thread.

When replying to a text event E the reply event's "p" tags should contain all of E's "p" tags as well as the `"pubkey"` of the event being replied to.  

Example:  Given a text event authored by `a1` with "p" tags [`p1`, `p2`, `p3`] then the "p" tags of the reply should be [`a1`, `p1`, `p2`, `p3`] 
in no particular order.


---

NIP-11
======

Relay Information Document
---------------------------

`draft` `optional` `author:scsibug`

Relays may provide server metadata to clients to inform them of capabilities, administrative contacts, and various server attributes.  This is made available as a JSON document over HTTP, on the same URI as the relay's websocket.

When a relay receives an HTTP(s) request with an `Accept` header of `application/nostr+json` to a URI supporting WebSocket upgrades, they SHOULD return a document with the following structure.

```json
{
  "name": <string identifying relay>,
  "description": <string with detailed information>,
  "pubkey": <administrative contact pubkey>,
  "contact": <administrative alternate contact>,
  "supported_nips": <a list of NIP numbers supported by the relay>,
  "software": <string identifying relay software URL>,
  "version": <string version identifier>
}
```

Any field may be omitted, and clients MUST ignore any additional fields they do not understand. Relays MUST accept CORS requests by sending `Access-Control-Allow-Origin`, `Access-Control-Allow-Headers`, and `Access-Control-Allow-Methods` headers.

Field Descriptions
-----------------

### Name ###

A relay may select a `name` for use in client software.  This is a string, and SHOULD be less than 30 characters to avoid client truncation.

### Description ###

Detailed plain-text information about the relay may be contained in the `description` string.  It is recommended that this contain no markup, formatting or line breaks for word wrapping, and simply use double newline characters to separate paragraphs.  There are no limitations on length.

### Pubkey ###

An administrative contact may be listed with a `pubkey`, in the same format as Nostr events (32-byte hex for a `secp256k1` public key).  If a contact is listed, this provides clients with a recommended address to send encrypted direct messages (See `NIP-04`) to a system administrator.  Expected uses of this address are to report abuse or illegal content, file bug reports, or request other technical assistance.

Relay operators have no obligation to respond to direct messages.

### Contact ###

An alternative contact may be listed under the `contact` field as well, with the same purpose as `pubkey`.  Use of a Nostr public key and direct message SHOULD be preferred over this.  Contents of this field SHOULD be a URI, using schemes such as `mailto` or `https` to provide users with a means of contact.

### Supported NIPs ###

As the Nostr protocol evolves, some functionality may only be available by relays that implement a specific `NIP`.  This field is an array of the integer identifiers of `NIP`s that are implemented in the relay.  Examples would include `1`, for `"NIP-01"` and `9`, for `"NIP-09"`.  Client-side `NIPs` SHOULD NOT be advertised, and can be ignored by clients.

### Software ###

The relay server implementation MAY be provided in the `software` attribute.  If present, this MUST be a URL to the project's homepage.

### Version ###

The relay MAY choose to publish its software version as a string attribute.  The string format is defined by the relay implementation.  It is recommended this be a version number or commit identifier.


---

NIP-12
======

Generic Tag Queries
-------------------

`draft` `optional` `author:scsibug` `author:fiatjaf`

Relays may support subscriptions over arbitrary tags.  `NIP-01` requires relays to respond to queries for `e` and `p` tags.  This NIP allows any single-letter tag present in an event to be queried.

The `<filters>` object described in `NIP-01` is expanded to contain arbitrary keys with a `#` prefix.  Any single-letter key in a filter beginning with `#` is a tag query, and MUST have a value of an array of strings.  The filter condition matches if the event has a tag with the same name, and there is at least one tag value in common with the filter and event.  The tag name is the letter without the `#`, and the tag value is the second element. Subsequent elements are ignored for the purposes of tag queries.

Example Subscription Filter
---------------------------

The following provides an example of a filter that matches events of kind `1` with an `r` tag set to either `foo` or `bar`.

```
{
  "kinds": [1],
  "#r": ["foo", "bar"]
}
```

Client Behavior
---------------

Clients SHOULD use the `supported_nips` field to learn if a relay supports generic tag queries. Clients MAY send generic tag queries to any relay, if they are prepared to filter out extraneous responses from relays that do not support this NIP.

Rationale
---------

The decision to reserve only single-letter tags to be usable in queries allow applications to make use of tags for all sorts of metadata, as it is their main purpose, without worrying that they might be bloating relay indexes. That also makes relays more lightweight, of course. And if some application or user is abusing single-letter tags with the intention of bloating relays that becomes easier to detect as single-letter tags will hardly be confused with some actually meaningful metadata some application really wanted to attach to the event with no spammy intentions.

Suggested Use Cases
-------------------

Motivating examples for generic tag queries are provided below.  This NIP does not promote or standardize the use of any specific tag for any purpose.

* Decentralized Commenting System: clients can comment on arbitrary web pages, and easily search for other comments, by using a `r` ("reference", in this case an URL) tag and value.
* Location-specific Posts: clients can use a `g` ("geohash") tag to associate a post with a physical location. Clients can search for a set of geohashes of varying precisions near them to find local content.
* Hashtags: clients can use simple `t` ("hashtag") tags to associate an event with an easily searchable topic name. Since Nostr events themselves are not searchable through the protocol, this provides a mechanism for user-driven search.


---

NIP-13
======

Proof of Work
-------------

`draft` `optional` `author:jb55` `author:cameri`

This NIP defines a way to generate and interpret Proof of Work for nostr notes. Proof of Work (PoW) is a way to add a proof of computational work to a note. This is a bearer proof that all relays and clients can universally validate with a small amount of code. This proof can be used as a means of spam deterrence.

`difficulty` is defined to be the number of leading zero bits in the `NIP-01` id. For example, an id of `000000000e9d97a1ab09fc381030b346cdd7a142ad57e6df0b46dc9bef6c7e2d` has a difficulty of `36` with `36` leading 0 bits.

Mining
------

To generate PoW for a `NIP-01` note, a `nonce` tag is used:

```json
{"content": "It's just me mining my own business", "tags": [["nonce", "1", "20"]]}
```

When mining, the second entry to the nonce tag is updated, and then the id is recalculated (see [NIP-01](./01.md)). If the id has the desired number of leading zero bits, the note has been mined. It is recommended to update the `created_at` as well during this process.

The third entry to the nonce tag `SHOULD` contain the target difficulty. This allows clients to protect against situations where bulk spammers targeting a lower difficulty get lucky and match a higher difficulty. For example, if you require 40 bits to reply to your thread and see a committed target of 30, you can safely reject it even if the note has 40 bits difficulty. Without a committed target difficulty you could not reject it. Committing to a target difficulty is something all honest miners should be ok with, and clients `MAY` reject a note matching a target difficulty if it is missing a difficulty commitment.

Example mined note
------------------

```json
{
  "id": "000006d8c378af1779d2feebc7603a125d99eca0ccf1085959b307f64e5dd358",
  "pubkey": "a48380f4cfcc1ad5378294fcac36439770f9c878dd880ffa94bb74ea54a6f243",
  "created_at": 1651794653,
  "kind": 1,
  "tags": [
    [
      "nonce",
      "776797",
      "20"
    ]
  ],
  "content": "It's just me mining my own business",
  "sig": "284622fc0a3f4f1303455d5175f7ba962a3300d136085b9566801bc2e0699de0c7e31e44c81fb40ad9049173742e904713c3594a1da0fc5d2382a25c11aba977"
}
```

Validating
----------

Here is some reference C code for calculating the difficulty (aka number of leading zero bits) in a nostr note id:

```c
int zero_bits(unsigned char b)
{
        int n = 0;

        if (b == 0)
                return 8;

        while (b >>= 1)
                n++;

        return 7-n;
}

/* find the number of leading zero bits in a hash */
int count_leading_zero_bits(unsigned char *hash)
{
        int bits, total, i;
        for (i = 0, total = 0; i < 32; i++) {
                bits = zero_bits(hash[i]);
                total += bits;
                if (bits != 8)
                        break;
        }
        return total;
}
```

Querying relays for PoW notes
-----------------------------

Since relays allow searching on prefixes, you can use this as a way to filter notes of a certain difficulty:

```
$ echo '["REQ", "subid", {"ids": ["000000000"]}]'  | websocat wss://some-relay.com | jq -c '.[2]'
{"id":"000000000121637feeb68a06c8fa7abd25774bdedfa9b6ef648386fb3b70c387", ...}
```

Delegated Proof of Work
-----------------------

Since the `NIP-01` note id does not commit to any signature, PoW can be outsourced to PoW providers, perhaps for a fee. This provides a way for clients to get their messages out to PoW-restricted relays without having to do any work themselves, which is useful for energy constrained devices like on mobile


---

NIP-14
======

Subject tag in Text events.
---------------------------

`draft` `optional` `author:unclebobmartin`

This NIP defines the use of the "subject" tag in text (kind: 1) events.  
(implemented in more-speech)

`["subject": <string>]`

Browsers often display threaded lists of messages.  The contents of the subject tag can be used in such lists, instead of the more ad hoc approach of using the first few words of the message.  This is very similar to the way email browsers display lists of incoming emails by subject rather than by contents.

When replying to a message with a subject, clients SHOULD replicate the subject tag.  Clients MAY adorn the subject to denote
that it is a reply.  e.g. by prepending "Re:".  

Subjects should generally be shorter than 80 chars.  Long subjects will likely be trimmed by clients.


---

NIP-15
======

End of Stored Events Notice
---------------------------

`final` `optional` `author:Semisol`

Relays may support notifying clients when all stored events have been sent.

If a relay supports this NIP, the relay SHOULD send the client a `EOSE` message in the format `["EOSE", <subscription_id>]` after it has sent all the events it has persisted and it indicates all the events that come after this message are newly published.

Client Behavior
---------------

Clients SHOULD use the `supported_nips` field to learn if a relay supports end of stored events notices.

Motivation
----------

The motivation for this proposal is to reduce uncertainty when all events have been sent by a relay to make client code possibly less complex.


---

NIP-16
======

Event Treatment
---------------

`draft` `optional` `author:Semisol`

Relays may decide to allow replaceable and/or ephemeral events.

Regular Events
------------------
A *regular event* is defined as an event with a kind `1000 <= n < 10000`.
Upon a regular event being received, the relay SHOULD send it to all clients with a matching filter, and SHOULD store it. New events of the same kind do not affect previous events in any way.

Replaceable Events
------------------
A *replaceable event* is defined as an event with a kind `10000 <= n < 20000`.
Upon a replaceable event with a newer timestamp than the currently known latest replaceable event with the same kind being received, and signed by the same key, the old event SHOULD be discarded and replaced with the newer event.

Ephemeral Events
----------------
An *ephemeral event* is defined as an event with a kind `20000 <= n < 30000`.
Upon an ephemeral event being received, the relay SHOULD send it to all clients with a matching filter, and MUST NOT store it.

Client Behavior
---------------

Clients SHOULD use the `supported_nips` field to learn if a relay supports this NIP.  Clients SHOULD NOT send ephemeral events to relays that do not support this NIP; they will most likely be persisted.  Clients MAY send replaceable events to relays that may not support this NIP, and clients querying SHOULD be prepared for the relay to send multiple events and should use the latest one.  

Suggested Use Cases
-------------------

* States: An application may create a state event that is replaced every time a new state is set (such as statuses)
* Typing indicators: A chat application may use ephemeral events as a typing indicator.
* Messaging: Two pubkeys can message over nostr using ephemeral events.


---

NIP-19
======

bech32-encoded entities
-----------------------

`draft` `optional` `author:jb55` `author:fiatjaf` `author:Semisol`

This NIP standardizes bech32-formatted strings that can be used to display keys, ids and other information in clients. These formats are not meant to be used anywhere in the core protocol, they are only meant for displaying to users, copy-pasting, sharing, rendering QR codes and inputting data.

It is recommended that ids and keys are stored in either hex or binary format, since these formats are closer to what must actually be used the core protocol.

## Bare keys and ids

To prevent confusion and mixing between private keys, public keys and event ids, which are all 32 byte strings. bech32-(not-m) encoding with different prefixes can be used for each of these entities.

These are the possible bech32 prefixes:

  - `npub`: public keys
  - `nsec`: private keys
  - `note`: note ids

Example: the hex public key `3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d` translates to `npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6`.

The bech32 encodings of keys and ids are not meant to be used inside the standard NIP-01 event formats or inside the filters, they're meant for human-friendlier display and input only. Clients should still accept keys in both hex and npub format for now, and convert internally.

## Shareable identifiers with extra metadata

When sharing a profile or an event, an app may decide to include relay information and other metadata such that other apps can locate and display these entities more easily.

For these events, the contents are a binary-encoded list of `TLV` (type-length-value), with `T` and `L` being 1 byte each (`uint8`, i.e. a number in the range of 0-255), and `V` being a sequence of bytes of the size indicated by `L`.

These are the possible bech32 prefixes with `TLV`:

  - `nprofile`: a nostr profile
  - `nevent`: a nostr event
  - `nrelay`: a nostr relay

These possible standardized `TLV` types are indicated here:

- `0`: `special`
  - depends on the bech32 prefix:
    - for `nprofile` it will be the 32 bytes of the profile public key
    - for `nevent` it will be the 32 bytes of the event id
    - for `nrelay`, this is the relay URL.
  - for `nprofile`, `nevent` and `nrelay` this may be included only once.
- `1`: `relay`
  - A relay in which the entity (profile or event) is more likely to be found, encoded as UTF-8. This may be included multiple times.
  - not applicable to `nrelay`.
## Examples

- `npub180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsyjh6w6` should decode into the public key hex `3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d` and vice-versa
- `nsec180cvv07tjdrrgpa0j7j7tmnyl2yr6yr7l8j4s3evf6u64th6gkwsgyumg0` should decode into the private key hex `3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d` and vice-versa
- `nprofile1qqsrhuxx8l9ex335q7he0f09aej04zpazpl0ne2cgukyawd24mayt8gpp4mhxue69uhhytnc9e3k7mgpz4mhxue69uhkg6nzv9ejuumpv34kytnrdaksjlyr9p` should decode into a profile with the following TLV items:
  - pubkey: `3bf0c63fcb93463407af97a5e5ee64fa883d107ef9e558472c4eb9aaaefa459d`
  - relay: `wss://r.x.com`
  - relay: `wss://djbas.sadkb.com`

## Notes

- `npub` keys MUST NOT be used in NIP-01 events or in NIP-05 JSON responses, only the hex format is supported there.


---

NIP-20
======


Command Results
---------------

`draft` `optional` `author:jb55`

When submitting events to relays, clients currently have no way to know if an event was successfully committed to the database. This NIP introduces the concept of command results which are like NOTICE's except provide more information about if an event was accepted or rejected.

A command result is a JSON object with the following structure that is returned when an event is successfully saved to the database or rejected:

    ["OK", <event_id>, <true|false>, <message>]

Relays MUST return `true` when the event is a duplicate and has already been saved. The `message` SHOULD start with `duplicate:` in this case.

Relays MUST return `false` when the event was rejected and not saved.

The `message` SHOULD provide additional information as to why the command succeeded or failed.

The `message` SHOULD start with `blocked:` if the pubkey or network address has been blocked, banned, or is not on a whitelist.

The `message` SHOULD start with `invalid:` if the event is invalid or doesn't meet some specific criteria (created_at is too far off, id is wrong, signature is wrong, etc)

The `message` SHOULD start with `pow:` if the event doesn't meet some proof-of-work difficulty. The client MAY consult the relay metadata at this point to retrieve the required posting difficulty.

The `message` SHOULD start with `rate-limited:` if the event was rejected due to rate limiting techniques.

The `message` SHOULD start with `error:` if the event failed to save due to a server issue.

Ephemeral events are not acknowledged with OK responses, unless there is a failure.

If the event or `EVENT` command is malformed and could not be parsed, a NOTICE message SHOULD be used instead of a command result. This NIP only applies to non-malformed EVENT commands.


Examples
--------

Event successfully written to the database:

    ["OK", "b1a649ebe8b435ec71d3784793f3bbf4b93e64e17568a741aecd4c7ddeafce30", true, ""]

Event successfully written to the database because of a reason:

    ["OK", "b1a649ebe8b435ec71d3784793f3bbf4b93e64e17568a741aecd4c7ddeafce30", true, "pow: difficulty 25>=24"]

Event blocked due to ip filter

    ["OK", "b1a649ebe8...", false, "blocked: tor exit nodes not allowed"]

Event blocked due to pubkey ban

    ["OK", "b1a649ebe8...", false, "blocked: you are banned from posting here"]

Event blocked, pubkey not registered

    ["OK", "b1a649ebe8...", false, "blocked: please register your pubkey at https://my-expensive-relay.example.com"]

Event rejected, rate limited

    ["OK", "b1a649ebe8...", false, "rate-limited: slow down there chief"]

Event rejected, `created_at` too far off

    ["OK", "b1a649ebe8...", false, "invalid: event creation date is too far off from the current time. Is your system clock in sync?"]

Event rejected, insufficient proof-of-work difficulty

    ["OK", "b1a649ebe8...", false, "pow: difficulty 26 is less than 30"]

Event failed to save, 

    ["OK", "b1a649ebe8...", false, "error: could not connect to the database"]



Client Handling
---------------

`messages` are meant for humans, with `reason:` prefixes so that clients can be slightly more intelligent with what to do with them. For example, with a `rate-limited:` reason the client may not show anything and simply try again with a longer timeout.

For the `pow:` prefix it may query relay metadata to get the updated difficulty requirement and try again in the background.

For the `invalid:` and `blocked`: prefix the client may wish to show these as styled error popups.

The prefixes include a colon so that the message can be cleanly separated from the prefix by taking everything after `:` and trimming it.


Future Extensions
-----------------

This proposal SHOULD be extended to support further commands in the future, such as REQ and AUTH. They are left out of this initial version to keep things simpler.


---

NIP-21
======

`nostr:` URL scheme
-------------------

`draft` `optional` `author:fiatjaf`

This NIP standardizes the usage of a common URL scheme for maximum interoperability and openness in the network.

The scheme is `nostr:`.

The identifiers that come after are expected to be the same as those defined in NIP-19 (except `nsec`).

## Examples

- `nostr:npub1sn0wdenkukak0d9dfczzeacvhkrgz92ak56egt7vdgzn8pv2wfqqhrjdv9`
- `nostr:nprofile1qqsrhuxx8l9ex335q7he0f09aej04zpazpl0ne2cgukyawd24mayt8gpp4mhxue69uhhytnc9e3k7mgpz4mhxue69uhkg6nzv9ejuumpv34kytnrdaksjlyr9p`
- `nostr:note1fntxtkcy9pjwucqwa9mddn7v03wwwsu9j330jj350nvhpky2tuaspk6nqc`
- `nostr:nevent1qqstna2yrezu5wghjvswqqculvvwxsrcvu7uc0f78gan4xqhvz49d9spr3mhxue69uhkummnw3ez6un9d3shjtn4de6x2argwghx6egpr4mhxue69uhkummnw3ez6ur4vgh8wetvd3hhyer9wghxuet5nxnepm`


---

NIP-22
======

Event `created_at` Limits
---------------------------

`draft` `optional` `author:jeffthibault` `author:Giszmo`

Relays may define both upper and lower limits within which they will consider an event's `created_at` to be acceptable. Both the upper and lower limits MUST be unix timestamps in seconds as defined in [NIP-01](01.md).

If a relay supports this NIP, the relay SHOULD send the client a [NIP-20](20.md) command result saying the event was not stored for the `created_at` timestamp not being within the permitted limits.

Client Behavior
---------------

Clients SHOULD use the [NIP-11](11.md) `supported_nips` field to learn if a relay uses event `created_at` time limits as defined by this NIP.

Motivation
----------

This NIP formalizes restrictions on event timestamps as accepted by a relay and allows clients to be aware of relays that have these restrictions.

The event `created_at` field is just a unix timestamp and can be set to a time in the past or future. Relays accept and share events dated to 20 years ago or 50,000 years in the future. This NIP aims to define a way for relays that do not want to store events with *any* timestamp to set their own restrictions.

[Replaceable events](16.md#replaceable-events) can behave rather unexpected if the user wrote them - or tried to write them - with a wrong system clock. Persisting an update with a backdated system now would result in the update not getting persisted without a notification and if they did the last update with a forward dated system, they will again fail to do another update with the now correct time.

A wide adoption of this NIP could create a better user experience as it would decrease the amount of events that appear wildly out of order or even from impossible dates in the distant past or future.

Keep in mind that there is a use case where a user migrates their old posts onto a new relay. If a relay rejects events that were not recently created, it cannot serve this use case.


Python (pseudocode) Example
---------------------------

```python
import time

TIME = int(time.time())
LOWER_LIMIT = TIME - (60 * 60 * 24) # Define lower limit as 1 day into the past
UPPER_LIMIT = TIME + (60 * 15)      # Define upper limit as 15 minutes into the future

if event.created_at not in range(LOWER_LIMIT, UPPER_LIMIT):
  ws.send('["OK", event.id, False, "invalid: the event created_at field is out of the acceptable range (-24h, +15min) for this relay"]')
```
Note: These are just example limits, the relay operator can choose whatever limits they want.


---


NIP-25
======

Reactions
---------

`draft` `optional` `author:jb55`

A reaction is a `kind 7` note that is used to react to other notes.

The generic reaction, represented by the `content` set to a `+` string, SHOULD
be interpreted as a "like" or "upvote".

A reaction with `content` set to `-` SHOULD be interpreted as a "dislike" or
"downvote". It SHOULD NOT be counted as a "like", and MAY be displayed as a
downvote or dislike on a post. A client MAY also choose to tally likes against
dislikes in a reddit-like system of upvotes and downvotes, or display them as
separate tallys.

The `content` MAY be an emoji, in this case it MAY be interpreted as a "like" or "dislike",
or the client MAY display this emoji reaction on the post.

Tags
----

The reaction event SHOULD include `e` and `p` tags from the note the user is
reacting to. This allows users to be notified of reactions to posts they were
mentioned in. Including the `e` tags enables clients to pull all the reactions
associated with individual posts or all the posts in a thread.

The last `e` tag MUST be the `id` of the note that is being reacted to. 

The last `p` tag MUST be the `pubkey` of the event being reacted to.

Example code

```swift
func make_like_event(pubkey: String, privkey: String, liked: NostrEvent) -> NostrEvent {
    var tags: [[String]] = liked.tags.filter { 
    	tag in tag.count >= 2 && (tag[0] == "e" || tag[0] == "p") 
    }
    tags.append(["e", liked.id])
    tags.append(["p", liked.pubkey])
    let ev = NostrEvent(content: "+", pubkey: pubkey, kind: 7, tags: tags)
    ev.calculate_id()
    ev.sign(privkey: privkey)
    return ev
}


---

NIP: 26
=======

Delegated Event Signing
-----

`draft` `optional` `author:markharding` `author:minds`

This NIP defines how events can be delegated so that they can be signed by other keypairs.

Another application of this proposal is to abstract away the use of the 'root' keypairs when interacting with clients. For example, a user could generate new keypairs for each client they wish to use and authorize those keypairs to generate events on behalf of their root pubkey, where the root keypair is stored in cold storage. 

#### Introducing the 'delegation' tag

This NIP introduces a new tag: `delegation` which is formatted as follows:

```json
[
  "delegation",
  <pubkey of the delegator>,
  <conditions query string>,
  <64-byte Schnorr signature of the sha256 hash of the delegation token>
]
```

##### Delegation Token

The **delegation token** should be a 64-byte Schnorr signature of the sha256 hash of the following string:

```
nostr:delegation:<pubkey of publisher (delegatee)>:<conditions query string>
```

##### Conditions Query String

The following fields and operators are supported in the above query string:

*Fields*:
1. `kind`
   -  *Operators*:
      -  `=${KIND_NUMBER}` - delegatee may only sign events of this kind
2. `created_at`
   -  *Operators*:
      -  `<${TIMESTAMP}` - delegatee may only sign events created ***before*** the specified timestamp
      -  `>${TIMESTAMP}` - delegatee may only sign events created ***after*** the specified timestamp

In order to create a single condition, you must use a supported field and operator. Multiple conditions can be used in a single query string, including on the same field. Conditions must be combined with `&`.

For example, the following condition strings are valid:

- `kind=1&created_at<1675721813`
- `kind=0&kind=1&created_at>1675721813`
- `kind=1&created_at>1674777689&created_at<1675721813`

For the vast majority of use-cases, it is advisable that query strings should include a `created_at` ***after*** condition reflecting the current time, to prevent the delegatee from publishing historic notes on the delegator's behalf.

#### Example

```
# Delegator:
privkey: ee35e8bb71131c02c1d7e73231daa48e9953d329a4b701f7133c8f46dd21139c
pubkey:  8e0d3d3eb2881ec137a11debe736a9086715a8c8beeeda615780064d68bc25dd

# Delegatee:
privkey: 777e4f60b4aa87937e13acc84f7abcc3c93cc035cb4c1e9f7a9086dd78fffce1
pubkey:  477318cfb5427b9cfc66a9fa376150c1ddbc62115ae27cef72417eb959691396
```

Delegation string to grant note publishing authorization to the delegatee (477318cf) from now, for the next 30 days, given the current timestamp is `1674834236`.
```json
nostr:delegation:477318cfb5427b9cfc66a9fa376150c1ddbc62115ae27cef72417eb959691396:kind=1&created_at>1674834236&created_at<1677426236
```

The delegator (8e0d3d3e) then signs a SHA256 hash of the above delegation string, the result of which is the delegation token:
```
6f44d7fe4f1c09f3954640fb58bd12bae8bb8ff4120853c4693106c82e920e2b898f1f9ba9bd65449a987c39c0423426ab7b53910c0c6abfb41b30bc16e5f524
```

The delegatee (477318cf) can now construct an event on behalf of the delegator (8e0d3d3e). The delegatee then signs the event with its own private key and publishes.
```json
{
  "id": "e93c6095c3db1c31d15ac771f8fc5fb672f6e52cd25505099f62cd055523224f",
  "pubkey": "477318cfb5427b9cfc66a9fa376150c1ddbc62115ae27cef72417eb959691396",
  "created_at": 1677426298,
  "kind": 1,
  "tags": [
    [
      "delegation",
      "8e0d3d3eb2881ec137a11debe736a9086715a8c8beeeda615780064d68bc25dd",
      "kind=1&created_at>1674834236&created_at<1677426236",
      "6f44d7fe4f1c09f3954640fb58bd12bae8bb8ff4120853c4693106c82e920e2b898f1f9ba9bd65449a987c39c0423426ab7b53910c0c6abfb41b30bc16e5f524"
    ]
  ],
  "content": "Hello, world!",
  "sig": "633db60e2e7082c13a47a6b19d663d45b2a2ebdeaf0b4c35ef83be2738030c54fc7fd56d139652937cdca875ee61b51904a1d0d0588a6acd6168d7be2909d693"
}
```

The event should be considered a valid delegation if the conditions are satisfied (`kind=1`, `created_at>1674834236` and `created_at<1677426236` in this example) and, upon validation of the delegation token, are found to be unchanged from the conditions in the original delegation string.

Clients should display the delegated note as if it was published directly by the delegator (8e0d3d3e).


#### Relay & Client Querying Support

Relays should answer requests such as `["REQ", "", {"authors": ["A"]}]` by querying both the `pubkey` and delegation tags `[1]` value.

---


NIP-28
======

Public Chat
-----------

`draft` `optional` `author:ChristopherDavid` `author:fiatjaf` `author:jb55` `author:Cameri`

This NIP defines new event kinds for public chat channels, channel messages, and basic client-side moderation.

It reserves five event kinds (40-44) for immediate use and five event kinds (45-49) for future use.

- `40 - channel create`
- `41 - channel metadata`
- `42 - channel message`
- `43 - hide message`
- `44 - mute user`

Client-centric moderation gives client developers discretion over what types of content they want included in their apps, while imposing no additional requirements on relays.

## Kind 40: Create channel

Create a public chat channel.

In the channel creation `content` field, Client SHOULD include basic channel metadata (`name`, `about`, `picture` as specified in kind 41).

```json
{
    "content": "{\"name\": \"Demo Channel\", \"about\": \"A test channel.\", \"picture\": \"https://placekitten.com/200/200\"}",
    ...
}
```


## Kind 41: Set channel metadata

Update a channel's public metadata.

Clients and relays SHOULD handle kind 41 events similar to kind 0 `metadata` events.

Clients SHOULD ignore kind 41s from pubkeys other than the kind 40 pubkey.

Clients SHOULD support basic metadata fields:

- `name` - string - Channel name
- `about` - string - Channel description
- `picture` - string - URL of channel picture

Clients MAY add additional metadata fields.

Clients SHOULD use [NIP-10](10.md) marked "e" tags to recommend a relay.

```json
{
    "content": "{\"name\": \"Updated Demo Channel\", \"about\": \"Updating a test channel.\", \"picture\": \"https://placekitten.com/201/201\"}",
    "tags": [["e", <channel_create_event_id>, <relay-url>]],
    ...
}
```


## Kind 42: Create channel message

Send a text message to a channel.

Clients SHOULD use [NIP-10](10.md) marked "e" tags to recommend a relay and specify whether it is a reply or root message.

Clients SHOULD append [NIP-10](10.md) "p" tags to replies.

Root message:

```json
{
    "content": <string>,
    "tags": [["e", <kind_40_event_id>, <relay-url>, "root"]],
    ...
}
```

Reply to another message:

```json
{
    "content": <string>,
    "tags": [
        ["e", <kind_42_event_id>, <relay-url>, "reply"],
        ["p", <pubkey>, <relay-url>],
        ...
    ],
    ...
}
```


## Kind 43: Hide message

User no longer wants to see a certain message.

The `content` may optionally include metadata such as a `reason`.

Clients SHOULD hide event 42s shown to a given user, if there is an event 43 from that user matching the event 42 `id`.

Clients MAY hide event 42s for other users other than the user who sent the event 43.

(For example, if three users 'hide' an event giving a reason that includes the word 'pornography', a Nostr client that is an iOS app may choose to hide that message for all iOS clients.)

```json
{
    "content": "{\"reason\": \"Dick pic\"}",
    "tags": [["e", <kind_42_event_id>]],
    ...
}
```

## Kind 44: Mute user

User no longer wants to see messages from another user.

The `content` may optionally include metadata such as a `reason`.

Clients SHOULD hide event 42s shown to a given user, if there is an event 44 from that user matching the event 42 `pubkey`.

Clients MAY hide event 42s for users other than the user who sent the event 44.

```json
{
    "content": "{\"reason\": \"Posting dick pics\"}",
    "tags": [["p", <pubkey>]],
    ...
}
```

## NIP-10 relay recommendations

For [NIP-10](10.md) relay recommendations, clients generally SHOULD use the relay URL of the original (oldest) kind 40 event.

Clients MAY recommend any relay URL. For example, if a relay hosting the original kind 40 event for a channel goes offline, clients could instead fetch channel data from a backup relay, or a relay that clients trust more than the original relay.


Future extensibility
--------------------

We reserve event kinds 45-49 for other events related to chat, to potentially include new types of media (photo/video), moderation, or support of private or group messaging.


Motivation
----------
If we're solving censorship-resistant communication for social media, we may as well solve it also for Telegram-style messaging.

We can bring the global conversation out from walled gardens into a true public square open to all.


Additional info
---------------

- [Chat demo PR with fiatjaf+jb55 comments](https://github.com/ArcadeCity/arcade/pull/28)
- [Conversation about NIP16](https://t.me/nostr_protocol/29566)


---

NIP-33
======

Parameterized Replaceable Events
--------------------------------

`draft` `optional` `author:Semisol` `author:Kukks` `author:Cameri` `author:Giszmo`

This NIP adds a new event range that allows for replacement of events that have the same `d` tag and kind unlike NIP-16 which only replaced by kind.

Implementation
--------------
The value of a tag is defined as the first parameter of a tag after the tag name.

A *parameterized replaceable event* is defined as an event with a kind `30000 <= n < 40000`.  
Upon a parameterized replaceable event with a newer timestamp than the currently known latest
replaceable event with the same kind and first `d` tag value being received, the old event
SHOULD be discarded and replaced with the newer event.  
A missing or a `d` tag with no value should be interpreted equivalent to a `d` tag with the
value as an empty string. Events from the same author with any of the following `tags`
replace each other:

* `"tags":[["d",""]]`
* `"tags":[]`: implicit `d` tag with empty value
* `"tags":[["d"]]`: implicit empty value `""`
* `"tags":[["d",""],["d","not empty"]]`: only first `d` tag is considered
* `"tags":[["d"],["d","some value"]]`: only first `d` tag is considered
* `"tags":[["e"]]`: same as no tags
* `"tags":[["d","test","1"]]`: only the value is considered (`test`)

Clients SHOULD NOT use `d` tags with multiple values and SHOULD include the `d` tag even if it has no value to allow querying using the `#d` filter.

Client Behavior
---------------

Clients SHOULD use the `supported_nips` field to learn if a relay supports this NIP.
Clients MAY send parameterized replaceable events to relays that may not support this NIP, and clients querying SHOULD be prepared for the relay to send multiple events and should use the latest one and are recommended to send a `#d` tag filter. Clients should account for the fact that missing `d` tags or ones with no value are not returned in tag filters, and are recommended to always include a `d` tag with a value.


---

NIP-36
======

Sensitive Content / Content Warning
-----------------------------------

`draft` `optional` `author:fernandolguevara`

The `content-warning` tag enables users to specify if the event's content needs to be approved by readers to be shown.
Clients can hide the content until the user acts on it.

#### Spec

```
tag: content-warning
options:
 - [reason]: optional  
```

#### Example

```json
{
    "pubkey": "<pub-key>",
    "created_at": 1000000000,
    "kind": 1,
    "tags": [
      ["t", "hastag"],
      ["content-warning", "reason"] /* reason is optional */
    ],
    "content": "sensitive content with #hastag\n",
    "id": "<event-id>"
}
```


---

NIP-40
======

Expiration Timestamp
-----------------------------------

`draft` `optional` `author:0xtlt`

The `expiration` tag enables users to specify a unix timestamp at which the message SHOULD be considered expired (by relays and clients) and SHOULD be deleted by relays.

#### Spec

```
tag: expiration
values:
 - [UNIX timestamp in seconds]: required
```

#### Example

```json
{
    "pubkey": "<pub-key>",
    "created_at": 1000000000,
    "kind": 1,
    "tags": [
      ["expiration", "1600000000"]
    ],
    "content": "This message will expire at the specified timestamp and be deleted by relays.\n",
    "id": "<event-id>"
}
```

Note: The timestamp should be in the same format as the created_at timestamp and should be interpreted as the time at which the message should be deleted by relays.

Client Behavior
---------------

Clients SHOULD use the `supported_nips` field to learn if a relay supports this NIP. Clients SHOULD NOT send expiration events to relays that do not support this NIP.

Clients SHOULD ignore events that have expired.

Relay Behavior
--------------

Relays MAY NOT delete an expired message immediately on expiration and MAY persist them indefinitely.  
Relays SHOULD NOT send expired events to clients, even if they are stored.  
Relays SHOULD drop any events that are published to them if they are expired.  
An expiration timestamp does not affect storage of ephemeral events.

Suggested Use Cases
-------------------

* Temporary announcements - This tag can be used to make temporary announcements. For example, an event organizer could use this tag to post announcements about an upcoming event.
* Limited-time offers - This tag can be used by businesses to make limited-time offers that expire after a certain amount of time. For example, a business could use this tag to make a special offer that is only available for a limited time.

#### Warning
The events could be downloaded by third parties as they are publicly accessible all the time on the relays.
So don't consider expiring messages as a security feature for your conversations or other uses.


---

NIP-42
======

Authentication of clients to relays
-----------------------------------

`draft` `optional` `author:Semisol` `author:fiatjaf`

This NIP defines a way for clients to authenticate to relays by signing an ephemeral event.

## Motivation

A relay may want to require clients to authenticate to access restricted resources. For example,

  - A relay may request payment or other forms of whitelisting to publish events -- this can naïvely be achieved by limiting publication
    to events signed by the whitelisted key, but with this NIP they may choose to accept any events as long as they are published from an
    authenticated user;
  - A relay may limit access to `kind: 4` DMs to only the parties involved in the chat exchange, and for that it may require authentication
    before clients can query for that kind.
  - A relay may limit subscriptions of any kind to paying users or users whitelisted through any other means, and require authentication.

## Definitions

This NIP defines a new message, `AUTH`, which relays can send when they support authentication and clients can send to relays when they want
to authenticate. When sent by relays, the message is of the following form:

```
["AUTH", <challenge-string>]
```

And, when sent by clients, of the following form:

```
["AUTH", <signed-event-json>]
```

The signed event is an ephemeral event not meant to be published or queried, it must be of `kind: 22242` and it should have at least two tags,
one for the relay URL and one for the challenge string as received from the relay.
Relays MUST exclude `kind: 22242` events from being broadcasted to any client.
`created_at` should be the current time. Example:

```json
{
  "id": "...",
  "pubkey": "...",
  "created_at": 1669695536,
  "kind": 22242,
  "tags": [
    ["relay", "wss://relay.example.com/"],
    ["challenge", "challengestringhere"]
  ],
  "content": "",
  "sig": "..."
}
```

## Protocol flow

At any moment the relay may send an `AUTH` message to the client containing a challenge. After receiving that the client may decide to
authenticate itself or not. The challenge is expected to be valid for the duration of the connection or until a next challenge is sent by
the relay.

The client may send an auth message right before performing an action for which it knows authentication will be required -- for example, right
before requesting `kind: 4` chat messages --, or it may do right on connection start or at some other moment it deems best. The authentication
is expected to last for the duration of the WebSocket connection.

Upon receiving a message from an unauthenticated user it can't fulfill without authentication, a relay may choose to notify the client. For
that it can use a `NOTICE` or `OK` message with a standard prefix `"restricted: "` that is readable both by humans and machines, for example:

```
["NOTICE", "restricted: we can't serve DMs to unauthenticated users, does your client implement NIP-42?"]
```

or it can return an `OK` message noting the reason an event was not written using the same prefix:

```
["OK", <event-id>, false, "restricted: we do not accept events from unauthenticated users, please sign up at https://example.com/"]
```

## Signed Event Verification

To verify `AUTH` messages, relays must ensure:

  - that the `kind` is `22242`;
  - that the event `created_at` is close (e.g. within ~10 minutes) of the current time;
  - that the `"challenge"` tag matches the challenge sent before;
  - that the `"relay"` tag matches the relay URL:
    - URL normalization techniques can be applied. For most cases just checking if the domain name is correct should be enough.


---

NIP-50
======

Search Capability
-----------------

`draft` `optional` `author:brugeman` `author:mikedilger` `author:fiatjaf`

## Abstract

Many Nostr use cases require some form of general search feature, in addition to structured queries by tags or ids. 
Specifics of the search algorithms will differ between event kinds, this NIP only describes a general 
extensible framework for performing such queries.

## `search` filter field 

A new `search` field is introduced for `REQ` messages from clients:
```json
{
  ...
  "search": <string>
}
```
`search` field is a string describing a query in a human-readable form, i.e. "best nostr apps". 
Relays SHOULD interpret the query to the best of their ability and return events that match it. 
Relays SHOULD perform matching against `content` event field, and MAY perform
matching against other fields if that makes sense in the context of a specific kind. 

A query string may contain `key:value` pairs (two words separated by colon), these are extensions, relays SHOULD ignore 
extensions they don't support.

Clients may specify several search filters, i.e. `["REQ", "", { "search": "orange" }, { "kinds": [1, 2], "search": "purple" }]`. Clients may 
include `kinds`, `ids` and other filter field to restrict the search results to particular event kinds.

Clients SHOULD use the supported_nips field to learn if a relay supports `search` filter. Clients MAY send `search` 
filter queries to any relay, if they are prepared to filter out extraneous responses from relays that do not support this NIP.

Clients SHOULD query several relays supporting this NIP to compensate for potentially different 
implementation details between relays.

Clients MAY verify that events returned by a relay match the specified query in a way that suits the
client's use case, and MAY stop querying relays that have low precision.

Relays SHOULD exclude spam from search results by default if they supports some form of spam filtering.

## Extensions

Relay MAY support these extensions:
- `include:spam` - turn off spam filtering, if it was enabled by default
