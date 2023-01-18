/* global require module */

const HDWalletProvider = require('@truffle/hdwallet-provider');

const testMnemonic = 'test test test test test test test test test test test junk';

module.exports = {
  networks: {
    develop: {
      provider: function() {
        return new HDWalletProvider(testMnemonic, "http://127.0.0.1:9545/");
      },
      network_id: '1337',
    },
    dashboard: {
    //   provider: () => new HDWalletProvider(MNEMONIC, `https://goerli.infura.io/v3/${PROJECT_ID}`),
    //   network_id: 5,       // Goerli's id
    },
  },
  // Set default mocha options here, use special reporters, etc.
  mocha: {
    // timeout: 100000
  },
  // Configure your compilers
  compilers: {
    solc: {
      version: "0.8.17" // Fetch exact version from solc-bin (default: truffle's version)
      // docker: true,        // Use "0.5.1" you've installed locally with docker (default: false)
      // settings: {          // See the solidity docs for advice about optimization and evmVersion
      //  optimizer: {
      //    enabled: false,
      //    runs: 200
      //  },
      //  evmVersion: "byzantium"
      // }
    }
  }
};
