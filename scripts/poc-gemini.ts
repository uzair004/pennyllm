/**
 * Phase 6 POC: Validate router.wrapModel() with real Gemini API
 *
 * Usage:
 *   GOOGLE_GENERATIVE_AI_API_KEY=your-key npx tsx scripts/poc-gemini.ts
 *
 * Expected output:
 *   - Response text from Gemini
 *   - Token usage counts (prompt + completion > 0)
 *   - Router usage snapshot showing recorded usage
 */

import { createRouter } from '../src/config/index.js';
import { generateText } from 'ai';

async function main() {
  // Check for required API key
  const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
  if (!apiKey) {
    console.error('Error: GOOGLE_GENERATIVE_AI_API_KEY environment variable is not set.');
    console.error('\nUsage:');
    console.error('  GOOGLE_GENERATIVE_AI_API_KEY=your-key npx tsx scripts/poc-gemini.ts');
    process.exit(1);
  }

  console.log('🚀 Phase 6 POC: Validating router.wrapModel() with real Gemini API\n');

  try {
    // Create router with minimal config
    console.log('Creating router with Google provider...');
    const router = await createRouter({
      providers: {
        google: {
          keys: [apiKey],
        },
      },
    });

    console.log('✓ Router created\n');

    // Wrap model using router
    console.log('Wrapping model: google/gemini-2.0-flash-exp...');
    const model = await router.wrapModel('google/gemini-2.0-flash-exp');
    console.log('✓ Model wrapped\n');

    // Call generateText with the wrapped model
    console.log('Calling generateText with prompt: "Say hello in exactly 5 words."\n');
    const result = await generateText({
      model,
      prompt: 'Say hello in exactly 5 words.',
    });

    // Display response
    console.log('📝 Response:');
    console.log(result.text);
    console.log();

    // Display token usage
    console.log('📊 Token Usage:');
    console.log(`  Prompt tokens:     ${result.usage.promptTokens}`);
    console.log(`  Completion tokens: ${result.usage.completionTokens}`);
    console.log(`  Total tokens:      ${result.usage.totalTokens}`);
    console.log();

    // Display router usage snapshot
    console.log('📈 Router Usage Snapshot:');
    const usageSnapshot = await router.getUsage('google');
    console.log(`  Prompt tokens:     ${usageSnapshot.totals.promptTokens}`);
    console.log(`  Completion tokens: ${usageSnapshot.totals.completionTokens}`);
    console.log(`  Total tokens:      ${usageSnapshot.totals.totalTokens}`);
    console.log(`  Call count:        ${usageSnapshot.totals.callCount}`);
    console.log();

    // Verify results
    if (result.usage.promptTokens === 0 || result.usage.completionTokens === 0) {
      console.error('❌ FAILED: Token usage counts are zero!');
      await router.close();
      process.exit(1);
    }

    if (usageSnapshot.totals.totalTokens === 0 || usageSnapshot.totals.callCount === 0) {
      console.error('❌ FAILED: Router usage tracking did not record the call!');
      await router.close();
      process.exit(1);
    }

    console.log('✅ SUCCESS: All validations passed!');
    console.log('   - Real API call succeeded');
    console.log('   - Token usage counts are non-zero');
    console.log('   - Router usage tracking recorded the call');

    // Clean up
    await router.close();
    process.exit(0);
  } catch (error) {
    console.error('❌ FAILED: Error during POC execution');
    console.error(error);
    process.exit(1);
  }
}

main();
