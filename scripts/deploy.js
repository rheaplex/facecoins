/* global __dirname hre process require */

const fs = require('fs');
const path = require('path');

const { ethers } = require("hardhat");


async function saveDetails(contractName, contract) {
  const json = {
    address: contract.address,
    abi: contract.interface.format(hre.ethers.utils.FormatTypes.json)
  };
  const chainName = hre.hardhatArguments.network;
  const filename = `${path.dirname(__dirname)}/app/js/${contractName}.${chainName}.json`;
  const serialized = JSON.stringify(json);
  fs.writeFileSync(filename, serialized);
}

async function deployContract(contractName) {
  const Contract = await hre.ethers.getContractFactory(contractName);
  const contract = await Contract.deploy();
  await contract.deployed();
  console.log(`${contractName} deployed to: ${contract.address}`);
  saveDetails(contractName, contract);
  return contract;
}

async function main() {
  await deployContract("Facecoin");
}
 
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
