function greet(name) {
  console.log("Hello, " + name);
  return name;
}

const users = ["alice", "bob"];
for (const u of users) {
  greet(u);
}

// shared tail
export default greet;
