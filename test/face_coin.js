const FaceCoin = artifacts.require("FaceCoin");

const NUM_TOKENS = 24;

contract("FaceCoin", function (accounts) {
  it("correct number of ERC721 tokens should exist", async () => {
    const fc = await FaceCoin.deployed();
    assert.equal((await fc.totalSupply()).toNumber(), NUM_TOKENS);
  });

  it("owner can transfer ERC721 tokens", async () => {
    const fc = await FaceCoin.deployed();
    try {
      await fc.transferFrom(accounts[0],
                            accounts[1],
                            1);
    } catch (error) {
      assert(false, "Owner should be able to transfer FC tokens");
    }
  });

  it("only owner can transfer ERC721 tokens", async () => {
    const fc = await FaceCoin.deployed();
    try {
      await fc.transferFrom(accounts[1],
                                accounts[2],
                                2,
                                {from: accounts[2]});
      assert(false, "FC should throw if non-owner tries to transfer token");
    } catch (error) {
      // test passed OK
    }
  });

  it("token URLs can be updated", async () => {
    const fc = await FaceCoin.deployed();
    await fc.setBaseUri("aaa://newurl/");
    assert.equal(await fc.tokenURI(3), "aaa://newurl/3");
  });

  it("only owner can set token URLs", async () => {
    const fc = await FaceCoin.deployed();
    try {
      await fc.setBaseUri("aaa://newerurl/", { from: accounts[2] });
      assert(false, "FC should throw if non-owner tries to set base URL");
    } catch (error) {
      // test passed OK
    }
  });

});
