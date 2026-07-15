import assert from "node:assert/strict";
import test from "node:test";

import {
  hashIntakePayload,
  normalizeBrazilianPhone,
  parseLeadIntake,
} from "../src/lib/lead-intake.ts";

test("normaliza telefones brasileiros para E.164", () => {
  assert.equal(normalizeBrazilianPhone("(51) 99999-9999"), "+5551999999999");
  assert.equal(normalizeBrazilianPhone("+55 51 99999-9999"), "+5551999999999");
  assert.equal(normalizeBrazilianPhone("51 3333-4444"), "+555133334444");
});

test("rejeita telefone ausente ou com quantidade invalida de digitos", () => {
  assert.throws(() => normalizeBrazilianPhone(""), /Telefone obrigatorio/);
  assert.throws(() => normalizeBrazilianPhone("123"), /Telefone brasileiro invalido/);
});

test("normaliza o payload de entrada e preserva atribuicao", () => {
  const payload = parseLeadIntake({
    name: "  Maria Silva  ",
    email: "  MARIA@EXAMPLE.COM ",
    phone: "(11) 98888-7777",
    source: " facebook ",
    medium: " paid_social ",
    campaign: " energia-julho ",
    consent: "granted",
    value: 25000,
    metadata: { formId: "123" },
  });

  assert.deepEqual(payload, {
    name: "Maria Silva",
    email: "maria@example.com",
    phone: "+5511988887777",
    source: "facebook",
    medium: "paid_social",
    campaign: "energia-julho",
    metaLeadId: undefined,
    fbclid: undefined,
    fbc: undefined,
    fbp: undefined,
    consent: "granted",
    externalEventId: undefined,
    value: 25000,
    metadata: { formId: "123" },
  });
});

test("rejeita payload e consentimento invalidos", () => {
  assert.throws(() => parseLeadIntake(null), /Payload JSON invalido/);
  assert.throws(() => parseLeadIntake({ phone: "51999999999", consent: "talvez" }), /Consentimento invalido/);
});

test("gera hash deterministico e sensivel ao conteudo", () => {
  const first = parseLeadIntake({ phone: "51999999999", campaign: "A" });
  const same = parseLeadIntake({ phone: "+55 51 99999-9999", campaign: "A" });
  const changed = parseLeadIntake({ phone: "51999999999", campaign: "B" });

  assert.equal(hashIntakePayload(first), hashIntakePayload(same));
  assert.notEqual(hashIntakePayload(first), hashIntakePayload(changed));
});
