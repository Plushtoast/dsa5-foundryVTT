import DSA5 from '../../config/config-dsa5.js';
import { SituationalModifiersWidget } from '../../system/helpers/situational-modifiers-widget.js';
import DiceDSA5 from '../../system/rolls/dice-dsa5.js';
import { ModifierCalculator } from '../concerns/modifier-calculator.js';

// TODO this should probably be part of the dialog

const { deepClone } = foundry.utils;

function resolveForm(dialogState) {
  const form = dialogState?.dialog?.element?.querySelector?.('form');
  return form || null;
}

function applySelectedCharacteristics(snapshot, formData) {
  if (!snapshot?.source?.system) return;

  for (let index = 0; index < 3; index++) {
    const field = `characteristics${index}`;
    const value = formData[field];
    if (value) snapshot.source.system[`characteristic${index + 1}`].value = value;
  }
}

export function createSkillDialogTestDataSnapshot(dialogState) {
  if (dialogState?.source?.type !== 'skill') return null;

  const form = resolveForm(dialogState);
  if (!form) return null;

  const html = dialogState.html?.jquery ? dialogState.html : $(form);
  const formData = new foundry.applications.ux.FormDataExtended(form).object;
  const snapshot = deepClone(dialogState.testData ?? {});

  snapshot.source = snapshot.source || deepClone(dialogState.source);
  snapshot.testDifficulty = DSA5.skillDifficultyModifiers[formData.testDifficulty] ?? 0;
  snapshot.situationalModifiers = SituationalModifiersWidget.collectFormModifiers(html);
  snapshot.situationalModifiers.push(ModifierCalculator.parseValueType(_loc('sight'), formData.vision || 0));
  snapshot.advancedModifiers = {
    chars: [0, 1, 2].map(index => Number(formData[`ch${index}`] || 0)),
    fws: Number(formData.fw || 0),
    qls: Number(formData.qs || 0),
  };
  snapshot.extra ??= {};
  snapshot.extra.options ??= {};

  applySelectedCharacteristics(snapshot, formData);

  return { formData, snapshot };
}

export async function getSkillDialogEffectiveModifier(dialogState) {
  const snapshotData = createSkillDialogTestDataSnapshot(dialogState);
  if (!snapshotData) return null;

  return snapshotData.snapshot.testDifficulty + (await DiceDSA5._situationalModifiers(snapshotData.snapshot));
}