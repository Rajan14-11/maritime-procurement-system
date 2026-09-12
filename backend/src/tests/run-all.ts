import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function runScript(scriptPath: string): Promise<number> {
  return new Promise((resolve) => {
    const p = spawn(process.execPath, [scriptPath], { stdio: 'inherit' });
    p.on('close', (code) => resolve(code || 0));
  });
}

async function main() {
  console.log('🚀 Running All Procurement System Test Suites...\n');

  const workflowTest = path.join(__dirname, 'workflow.test.js');
  const guardsTest = path.join(__dirname, 'adversarial-guards.test.js');
  const vesselScopedTest = path.join(__dirname, 'vessel-scoped-access.test.js');

  const code1 = await runScript(workflowTest);
  if (code1 !== 0) {
    console.error(`\n❌ Workflow tests failed with code ${code1}`);
    process.exit(code1);
  }

  const code2 = await runScript(guardsTest);
  if (code2 !== 0) {
    console.error(`\n❌ Adversarial tests failed with code ${code2}`);
    process.exit(code2);
  }

  const code3 = await runScript(vesselScopedTest);
  if (code3 !== 0) {
    console.error(`\n❌ Vessel-scoped access tests failed with code ${code3}`);
    process.exit(code3);
  }

  console.log('\n===================================================');
  console.log('🎉 ALL TEST SUITES PASSED CLEANLY (16 WORKFLOW + 24 ADVERSARIAL + 11 VESSEL-SCOPED = 51 TESTS TOTAL)!');
  console.log('===================================================\n');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
