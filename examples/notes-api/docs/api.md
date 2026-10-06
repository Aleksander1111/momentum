# The notes API

Every answer is JSON unless said otherwise. A client error answers its status with `{ "error": "<reason>" }`,
and a validation error adds `details` with zod's issues.

| Method | Path | Answer |
| --- | --- | --- |
| GET | `/health` | 200 `{ ok, version }` |
| GET | `/notes` | 200 with every note; `?tag=` keeps one tag's notes, `?q=` searches them (every word must match; titles rank first) |
| GET | `/notes/:id` | 200 with the note; 404 when missing; 400 when the id is not a positive integer |
| POST | `/notes` | 201 with the new note; 400 when the body is not JSON or the title is missing |
| PATCH | `/notes/:id` | 200 with the changed note; the fields left out stay |
| DELETE | `/notes/:id` | 204; 404 when missing |
| GET | `/tags` | 200 with `[{ tag, notes }]`, most used first |
| GET | `/export` | 200 `text/markdown`: one document of the notes `?tag=` and `?q=` select |

A note: `{ id, title, body, tags, createdAt, updatedAt }`. Tags are lower case with dashes for spaces.
A path nobody serves is 404; a served path under the wrong method is 405.
