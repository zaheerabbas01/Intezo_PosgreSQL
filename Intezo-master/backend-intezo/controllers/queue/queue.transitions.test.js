import test from 'node:test';
import assert from 'node:assert/strict';
import {
  resolveAdvanceNumber,
  shouldServeCurrentPatient
} from './queue.transitions.js';

test('calls the first patient without completing them', () => {
  assert.equal(resolveAdvanceNumber({
    action: 'next',
    currentServing: 0,
    nextPatientNumber: 1
  }), 1);
});

test('moves from the current patient to the next patient', () => {
  assert.equal(resolveAdvanceNumber({
    action: 'next',
    currentServing: 4,
    nextPatientNumber: 5
  }), 5);
});

test('finishes the last current patient by clearing now serving', () => {
  assert.equal(resolveAdvanceNumber({
    action: 'next',
    currentServing: 5,
    nextPatientNumber: null
  }), 0);
});

test('allows the last current patient to be skipped', () => {
  assert.equal(resolveAdvanceNumber({
    action: 'skip',
    currentServing: 5,
    nextPatientNumber: null
  }), 0);
});

test('does not skip when no patient is currently being served', () => {
  assert.throws(() => resolveAdvanceNumber({
    action: 'skip',
    currentServing: 0,
    nextPatientNumber: 1
  }), /NO_CURRENT_PATIENT/);
});

test('reports an empty queue when no current or next patient exists', () => {
  assert.throws(() => resolveAdvanceNumber({
    action: 'next',
    currentServing: 0,
    nextPatientNumber: null
  }), /NO_MORE_PATIENTS/);
});

test('does not serve the first patient when they are called', () => {
  assert.equal(shouldServeCurrentPatient({
    action: 'next',
    currentServing: 0,
    newNumber: 1,
    hasCurrentQueue: false
  }), false);
});

test('serves the current patient when the following patient is called', () => {
  assert.equal(shouldServeCurrentPatient({
    action: 'next',
    currentServing: 4,
    newNumber: 5,
    hasCurrentQueue: true
  }), true);
});

test('serves the final patient only when finish clears now serving', () => {
  assert.equal(shouldServeCurrentPatient({
    action: 'next',
    currentServing: 5,
    newNumber: 0,
    hasCurrentQueue: true
  }), true);
});

test('never serves a skipped patient', () => {
  assert.equal(shouldServeCurrentPatient({
    action: 'skip',
    currentServing: 5,
    newNumber: 0,
    hasCurrentQueue: true
  }), false);
});
