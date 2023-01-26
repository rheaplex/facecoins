const fs = require('fs');

/*const ipfsClient = require('ipfs-http-client')
const ipfs = ipfsClient('localhost', '5001', { protocol: 'http' })*/

const NUM_TOKENS = 24;
const TOKEN_BASE = 1;

const IMG_URL_BASE = "ipfs:///QmQHxZCdW5Gq9YCrcGbvrvYx5LZ6reL9Aev5td8GNAuatC";
const SHOW_URL_BASE = "https://show.rhea.art/facecoins/index.html";

if (!fs.existsSync("metadata")){
    fs.mkdirSync("./metadata");
}


for(let i = 0; i < NUM_TOKENS; i++) {
  const tokenNum = TOKEN_BASE + i;
  const filePath = `./metadata/${tokenNum}`;
  fs.writeFileSync(
    filePath,
    `{
"description": "A blockchain portrait that starts with you.",
"external_url": "${SHOW_URL_BASE}#${tokenNum}",
"image": "${IMG_URL_BASE}/${tokenNum}.png",
"name": "Facecoins ${tokenNum}"
}`
  );
}
