import test from 'node:test';
import assert from 'node:assert/strict';
import { fieldValidationExample } from '../src/validation.js';

test('fieldValidationExample describes the supported signing fields', () => {
  assert.deepEqual(fieldValidationExample, ['text', 'number', 'date', 'signature', 'checkbox']);
});
