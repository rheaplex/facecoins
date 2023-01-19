const fs = require('fs');

const NUM_TOKENS = 24;
const TOKEN_BASE = 1;

for(let i = 0; i < NUM_TOKENS; i++) {
  const tokenNum = TOKEN_BASE + i;
  const dest = `./images/${tokenNum}.png`;
  fs.copyFileSync("./images/1.png", dest);
}
