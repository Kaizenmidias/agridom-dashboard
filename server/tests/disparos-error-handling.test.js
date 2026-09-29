const test = require("node:test");
const assert = require("node:assert/strict");
const { providerError } = require("../services/evolution-whatsapp-provider");
const {
  classifyBroadcastError,
  broadcastErrorMessage,
} = require("../services/broadcast-campaign-worker");

test("DISPAROS preserva diagnóstico seguro de resposta HTTP da Evolution", () => {
  const error = providerError(
    "A Evolution recusou a operacao.",
    "EVOLUTION_REQUEST_FAILED",
    false,
    {
      status: 400,
      response: {
        status: 400,
        data: {
          status: 400,
          error: "Bad Request",
          message: ["destination invalid"],
        },
      },
      config: {
        method: "post",
        url: "https://evolution.example/message/sendText/instance-1",
      },
    },
  );
  assert.equal(error.providerStatus, 400);
  assert.equal(error.providerCode, "400");
  assert.match(error.providerMessage, /destination invalid/);
  assert.equal(error.retryable, false);
  assert.doesNotMatch(error.providerMessage, /apikey|authorization|token/i);
  assert.equal(broadcastErrorMessage(error), "A Evolution recusou o envio.");
});

test("DISPAROS classifica apenas falhas transitórias para retry", () => {
  const temporary = classifyBroadcastError(
    Object.assign(new Error("timeout"), { code: "EVOLUTION_TIMEOUT" }),
  );
  const permanent = classifyBroadcastError(
    Object.assign(new Error("bad request"), {
      code: "EVOLUTION_REQUEST_FAILED",
    }),
  );
  assert.equal(temporary.retryable, true);
  assert.equal(permanent.retryable, false);
});
