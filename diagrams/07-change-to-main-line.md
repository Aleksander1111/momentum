# Change to main line

Source: [SPEC.md → Knowledge base](../SPEC.md#knowledge-base), [Consistency guard](../SPEC.md#consistency-guard), [Attention feed](../SPEC.md#attention-feed)

```mermaid
flowchart TB
  Run["Run — own checkout, own branch"]
  Change["Knowledge base change<br/>free read and write, nothing gates work in progress"]
  Guard["Consistency guard<br/>on every change"]
  Tx["Transaction<br/>related changes grouped"]
  Valid{"Summary limits and<br/>references valid?"}
  Issue["Issue summary"]
  Index["Index and metrics database updated"]
  Feed["Attention feed"]
  User{"User"}
  Main["Main line — approved state"]
  Back["Change request, split into several summaries,<br/>or new summaries alongside it"]
  Run --> Change --> Guard --> Tx --> Valid
  Valid -->|"yes"| Index --> Feed
  Valid -->|"cannot be made consistent"| Issue --> Feed
  Feed --> User
  User -->|"approves"| Main
  User -->|"sends back"| Back
```
