require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const accountsFromEnv = process.env.DEPLOYER_PRIVATE_KEY
  ? [process.env.DEPLOYER_PRIVATE_KEY]
  : undefined;

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      evmVersion: "paris",
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },
  networks: {
    hardhat: {
      chainId: parseInt(process.env.CHAIN_ID || "31337"),
    },
    sepolia: {
      url: process.env.SEPOLIA_RPC_URL || "https://rpc.sepolia.org",
      chainId: 11155111,
      accounts: process.env.DEPLOYER_PRIVATE_KEY ? [process.env.DEPLOYER_PRIVATE_KEY] : [],
    },
    localhost: {
      url: process.env.RPC_URL || "http://127.0.0.1:8545",
      chainId: parseInt(process.env.CHAIN_ID || "31337"),
      accounts: accountsFromEnv,
    },
    besu_local: {
      // Retained strictly for local development only - not used in production/testnet deployment path
      url: process.env.BESU_RPC_URL || "http://127.0.0.1:8545",
      chainId: parseInt(process.env.BESU_CHAIN_ID || "1337"),
      gasPrice: 0,
      accounts: accountsFromEnv,
    },
  },
  etherscan: {
    apiKey: process.env.ETHERSCAN_API_KEY || "",
  },
  paths: {
    sources: "./contracts",
    tests: "./test",
    cache: "./cache",
    artifacts: "./artifacts",
  },
  mocha: {
    reporter: 'spec',
    timeout: 40000
  }
};
