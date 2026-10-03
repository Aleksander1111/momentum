const seed = [
  { title: 'The Pragmatic Programmer', author: 'Andrew Hunt and David Thomas', year: 1999 },
  { title: 'Refactoring', author: 'Martin Fowler', year: 1999 },
  { title: 'Clean Code', author: 'Robert C. Martin', year: 2008 },
  { title: 'Designing Data-Intensive Applications', author: 'Martin Kleppmann', year: 2017 },
  { title: 'The Mythical Man-Month', author: 'Frederick P. Brooks Jr.', year: 1975 },
];

/** An in-memory book store, seeded with a few books; contents reset on restart */
export function createStore(books = seed) {
  const list = books.map((book, i) => ({ id: i + 1, ...book }));

  return {
    all() {
      return list;
    },
    get(id) {
      return list.find((book) => book.id === id);
    },
    add({ title, author, year }) {
      const book = { id: list.length + 1, title, author, year };
      list.push(book);
      return book;
    },
  };
}
