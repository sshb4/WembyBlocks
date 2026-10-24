import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

test('form requires consent and verification, saves via backend, and skip submits nothing', async () => {
  const elements = new Map();
  for (const id of ['sms-form', 'sms-form-submit', 'sms-form-skip', 'sms-consent', 'sms-form-status', 'sms-phone', 'sms-turnstile']) {
    elements.set(id, { handlers: {}, dataset: {}, checked: false, value: '',
      addEventListener(event, handler) { this.handlers[event] = handler; },
      focus() {}, scrollIntoView() {}, getBoundingClientRect() { return { width: 320 }; }
    });
  }
  const get = id => elements.get(id);
  get('sms-form').reportValidity = () => true;
  get('sms-form').reset = () => { get('sms-consent').checked = false; get('sms-phone').value = ''; };
  const config = { apiBaseUrl: 'https://signup.example', turnstileSiteKey: 'test-key' };
  let challenge, resets = 0;
  const window = { WEMBY_ALERTS: config, GIBBS_ALERTS: config, addEventListener() {}, turnstile: {
    render(selector, options) { challenge = options; return 0; }, reset() { resets++; }
  } };
  const requests = [];
  const document = { getElementById: get, querySelectorAll: () => [], createElement: () => ({}), head: { append() {} } };
  vm.runInNewContext(readFileSync(new URL('../../alerts.js', import.meta.url), 'utf8'), {
    window, document, URL, AbortSignal, fetch: async (url, options) => {
      requests.push({ url, data: JSON.parse(options.body) });
      return { ok: true, json: async () => ({ message: 'Your request is saved. Reply YES at launch.' }) };
    }
  });
  const submit = () => get('sms-form').handlers.submit({ preventDefault() {} });
  await submit();
  assert.equal(requests.length, 0);
  (window.onWembyTurnstileReady || window.onGibbsTurnstileReady)();
  get('sms-phone').value = '(210) 555-0123';
  get('sms-consent').checked = true;
  get('sms-consent').handlers.change();
  await submit();
  assert.equal(requests.length, 0);
  challenge.callback('verified-token');
  await submit();
  assert.deepEqual(requests, [{ url: 'https://signup.example/subscribe', data: {
    phone: '(210) 555-0123', consent: true, token: 'verified-token'
  } }]);
  assert.equal(get('sms-consent').checked, false);
  assert.equal(get('sms-form-status').dataset.state, 'success');
  get('sms-phone').value = '(210) 555-0123';
  get('sms-form-skip').handlers.click();
  assert.equal(requests.length, 1);
  assert.equal(get('sms-phone').value, '');
  assert.equal(resets, 2);
});
