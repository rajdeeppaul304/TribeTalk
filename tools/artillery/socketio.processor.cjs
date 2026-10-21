module.exports = {
  loadToken: (context, events, done) => {
    context.vars.token = process.env.ACCESS_TOKEN || "replace-with-access-token";
    context.vars.channelId = process.env.CHANNEL_ID || "replace-with-channel-id";
    context.vars.loadTestKey = process.env.LOAD_TEST_KEY || "";
    return done();
  },
  prepareMessage: (context, events, done) => {
    context.vars.clientId = `artillery-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    context.vars.content = process.env.MESSAGE_CONTENT || "part2 reliability probe";
    return done();
  },
};
