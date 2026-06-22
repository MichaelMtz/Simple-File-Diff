function greet(name, greeting) {
  console.log(greeting + ", " + name + "!");
  return name;
}

const users = ["alice", "carol", "dave"];
for (const u of users) {
  greet(u, "Hi");
}
const extra = true;

// shared tail
export default greet;
