//    facecoin.js - Face recognition in hashes as aesthetic proof of work.
//    Copyright (C) 2014,2018 Rhea Myers <rhea@myers.studio>
//    Copyright (C) 2022,2023 Myers Studio Ltd.
//
//    This program is free software: you can redistribute it and/or modify
//    it under the terms of the GNU General Public License as published by
//    the Free Software Foundation, either version 3 of the License, or
//    (at your option) any later version.
//
//    This program is distributed in the hope that it will be useful,
//    but WITHOUT ANY WARRANTY; without even the implied warranty of
//    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
//    GNU General Public License for more details.
//
//    You should have received a copy of the GNU General Public License
//    along with this program.  If not, see <http://www.gnu.org/licenses/>.

/* global cascade ccv stackBlurCanvasRGB */


///////////////////////////////////////////////////////////////////////////////
// Configuration
///////////////////////////////////////////////////////////////////////////////

const bitmap_size = 16; // 8 for 8-bit
const canvas_size = 256;
const canvas_scale = canvas_size / bitmap_size;
const blur_radius = 10; // 32
const match_line_width = 2;
const half_match_line_width = match_line_width / 2;
const extra_text_height = 234;
const truncate_blocks_at = 128;

const NUM_TOKENS = 16;
const DEFAULT_TOKEN_ID = 1;

///////////////////////////////////////////////////////////////////////////////
// Globals
///////////////////////////////////////////////////////////////////////////////

// Should encapsulate

let ui;

let tokenId;

let blurredFaceCanvas;

let foreground;
let background;
let tries;
let digest;
let previousDigest;

let startBlockNumber;

let matches;

///////////////////////////////////////////////////////////////////////////////
// Create UI for each block
///////////////////////////////////////////////////////////////////////////////

const createSection = where => {
  const figure = document.createElement("span");
  figure.classList.add("page-grid-cell");
  // This is so the first cell isn't shorter than the others
  figure.style.height = canvas_size + extra_text_height;
  const canvas = document.createElement("canvas");
  canvas.width = canvas_size;
  canvas.height = canvas_size;
  const caption = document.createElement("p");
  caption.style["overflow-wrap"] = "break-word";
  caption.style.width = canvas_size;
  figure.append(canvas);
  figure.append(caption);
  document.getElementById(where).append(figure);
  return {
    figure: figure,
    canvas: canvas,
    caption: caption,
    ctx: canvas.getContext("2d")
  };
};

///////////////////////////////////////////////////////////////////////////////
// The digest
///////////////////////////////////////////////////////////////////////////////

const sha256Hex = async data => Array.from(
  new Uint8Array(
    await crypto.subtle.digest("SHA-256",
                               new TextEncoder().encode(data))
  )).map((bytes) => bytes.toString(16).padStart(2, "0"))
      .join("");

const newDigest = async () => {
  const digest = await sha256Hex(previousDigest + tries);
  // Ensure the first and subsequent layouts line up
  const prev = previousDigest ? previousDigest : "None<br /><br />" ;
  ui.caption.innerHTML = "<b>Previous&nbsp;Digest:</b>&nbsp;" + prev +
    "&nbsp;<br /><b>Nonce:</b>&nbsp;" + tries +
    "<br /><b>SHA&#8209;256:</b>&nbsp;" + digest;
  return digest;
};

///////////////////////////////////////////////////////////////////////////////
// Drawing the digest as a bitmap
///////////////////////////////////////////////////////////////////////////////

/*const pixelValue8Bit = (x, y, bitmap_width, digest) => {
  const index = x + (y * bitmap_width);
  const grey = parseInt(digest[index], 16) * 16;
  return grey;
};*/

const pixelValue1Bit = (x, y, bitmap_width, digest) => {
  const byte_index = Math.floor((x + (y * bitmap_width)) / 4);
  const bit_index = (x + (y * bitmap_width)) % 4;
  let colour;
  if (((parseInt(digest[byte_index], 16) >> bit_index) & 0x01) == 0) {
    colour = foreground;
  } else {
    colour = background;
  }
  return colour;
};

const pixelValue = pixelValue1Bit;

// Ideally we'd just upscale and tween pixel values, but this looks better

const drawFace = (ui, digest) => {
   for(let y = 0; y < bitmap_size; y++) {
    for (let x = 0; x < bitmap_size; x++) {
      const colour = pixelValue(x, y, bitmap_size, digest);
      // Slower than other alternatives, but clear
      ui.ctx.fillStyle = colour;
      ui.ctx.fillRect(x * canvas_scale, y * canvas_scale,
                      canvas_scale, canvas_scale);
    }
  }
};

const copyFaceBlurred = (srcCanvas, destCanvas) => {
  const destCtx = destCanvas.getContext("2d");
  destCtx.drawImage(srcCanvas, 0, 0);
  stackBlurCanvasRGB(destCtx, 0, 0, canvas_size, canvas_size, blur_radius);
};

///////////////////////////////////////////////////////////////////////////////
// Detecting the face in the digest bitmap
///////////////////////////////////////////////////////////////////////////////

const detectFace = canvas => {
  //copyFaceBlurred(canvas, blurredFaceCanvas);
  const matches = ccv.detect_objects(
    { "canvas" : ccv.grayscale(ccv.pre(canvas)),
      "cascade" : cascade,
      "interval" : 5,
      "min_neighbors" : 1 });
  return matches;
};

const drawMatches = (ui, matches) => {
  // Just draw the first one
  // In testing, multiples were overlapping matches of the same feature
  const match = matches[0];
  //matches.forEach(function(match) {
  // Un-clamped values, for comparison
  /*console.log(match);
  ui.ctx.lineWidth = match_line_width;
  ui.ctx.strokeStyle = "rgb(0, 0, 255)";
  // Inset the box, especially for bitmap edges so lines are always same width
  ui.ctx.rect(
    match.x,
    match.y,
    match.width,
    match.height
  );*/
  // Clamp to bitmap pixel boundaries
  const x = Math.round(match.x / canvas_scale);
  const y = Math.round(match.y / canvas_scale);
  const width = Math.round(match.width / canvas_scale);
  const height = Math.round(match.height / canvas_scale);
  ui.ctx.lineWidth = match_line_width;
  ui.ctx.strokeStyle = "rgb(255, 0, 0)";
  // Inset the box, especially for bitmap edges so lines are always same width
  ui.ctx.rect(
    (x  * canvas_scale) + half_match_line_width,
    (y * canvas_scale) + half_match_line_width,
    (width * canvas_scale) - half_match_line_width,
    (height * canvas_scale) - half_match_line_width
  );
  ui.ctx.stroke();
  // LTRB "litterbug" order co-ordinates (makes sense for top left 0, 0)
  ui.caption.innerHTML +=
    `<br /><b>Face:</b>&nbsp; ${x}, ${y}, ${x + width}, ${y + height}`;
  //});
};

///////////////////////////////////////////////////////////////////////////////
// Token ID
///////////////////////////////////////////////////////////////////////////////

const maybeSetTokenFromHash = () => {
  const id = window.location.hash.substr(1);
  if (id > 0 && id <= NUM_TOKENS) {
    tokenId = id;
  } else {
    // Reload the page with a working token id
    window.location.hash = DEFAULT_TOKEN_ID;
  }
};

///////////////////////////////////////////////////////////////////////////////
// Network
///////////////////////////////////////////////////////////////////////////////

let facecoinContract;
let provider;

const initNetwork = async () => {
  provider = new ethers.providers.Web3Provider(window.ethereum);
  // Just reload the window if the network changes
  provider.on("chainChanged", () => { window.location.reload(); });
  const facecoinJson = await ethers.utils.fetchJson(
    "./js/FaceCoin.json"
  );
  facecoinContract = new ethers.Contract(
    facecoinJson.networks[(await provider.getNetwork()).chainId].address,
    facecoinJson.abi,
    provider
  );

  const transfer = facecoinContract.filters.Transfer(
    null,
    null,
    ethers.BigNumber.from(tokenId)
  );
  
  facecoinContract.on(transfer, onFacecoinTransfer);
};

const onFacecoinTransfer = async (from, to, id, ...rest) => {
  // Ignore a transfer that happens in the current block.
  const event = rest[rest.length - 1];
  if(event.blockNumber <= startBlockNumber) {
    return;
  }
  await updateState();
  nextBlock();
};

const updateState = async () => {
  const palette = [[255, 255, 255], [0, 0, 0]];/*await facecoinContract
        .tokenPalette(ethers.BigNumber.from(tokenId));*/
  background = `rgb(${palette[0].join(",")})`;
  foreground = `rgb(${palette[1].join(",")})`;
  matches = false;
  tries = 0;
  previousDigest = "";/*await facecoinContract
    .ownerOf(ethers.BigNumber.from(tokenId));*/
  startBlockNumber = 0;
  digest = null;
};

///////////////////////////////////////////////////////////////////////////////
// Main flow of execution
///////////////////////////////////////////////////////////////////////////////

const nextBlock = () => {
  // Don't add too many elements to the page, we don't want to hog memory
  const elements = document.getElementsByClassName("page-grid-cell");
  const to_truncate_at = Math.floor(truncate_blocks_at / 2);
  while (elements.length >= to_truncate_at)
  {
    const element = elements[0];
    element.parentNode.removeChild(element);
  }
  // Set up the state for the new block
  matches = false;
  tries = 0;
  // Create the ui section for the new block
  ui = createSection("blocks");
  document.body.animate({scrollTop: document.height}, 1000);
  // And do the work
  animationLoop();
};


const animationLoop = async () => {
  if (matches != false) {
    drawMatches(ui.canvas, matches);
    previousDigest = digest;
    nextBlock();
  } else {
    window.requestAnimationFrame(animationLoop);
    tries = tries + 1;
    digest = await newDigest();
    drawFace(ui, digest);
    //copyBlurred(ui);
    matches = await detectFace(ui.canvas);
  }
};

const loadingFinished = () => {
  const loading = document.getElementById("loading");
    loading.parentNode.removeChild(loading);
};

window.addEventListener("DOMContentLoaded", async () => {
  //maybeSetTokenFromHash();
  
  blurredFaceCanvas = document.createElement("canvas");
  blurredFaceCanvas.width = canvas_size;
  blurredFaceCanvas.height = canvas_size;
  
  //await initNetwork();
  await updateState();

  loadingFinished();
  
  nextBlock();
});
