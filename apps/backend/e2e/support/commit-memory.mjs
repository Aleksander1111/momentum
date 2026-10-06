// Commits memory one gigabyte at a time, up to the number of gigabytes asked for, and prints how far it got as JSON: a
// process held to a job memory limit is refused before it passes the limit.
const want = Number(process.argv[2] ?? 5);
const held = [];
let refused = null;
for (let i = 0; i < want; i++) {
  try {
    // Filled, so the pages are committed, not only reserved
    held.push(Buffer.alloc(1024 ** 3, 1));
  } catch (e) {
    refused = e.message;
    break;
  }
}
console.log(JSON.stringify({ committedGb: held.length, refused }));
