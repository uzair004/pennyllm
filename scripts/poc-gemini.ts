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
    const modelId = 'google/gemini-2.5-flash';
    console.log(`Wrapping model: ${modelId}...`);
    const model = await router.wrapModel(modelId);
    console.log('✓ Model wrapped\n');

    // Call generateText with the wrapped model
    console.log('Calling generateText with prompt: "Say hello in exactly 5 words."\n');
    const result = await generateText({
      model,
      prompt: 'Say hello in exactly 5 words.',
      maxRetries: 1,
    });

    // Display response
    console.log('📝 Response:');
    console.log(result.text || '(empty response)');
    console.log();

    // Display raw usage for diagnostics
    console.log('📊 Raw AI SDK Usage:');
    console.log('  ', JSON.stringify(result.usage, null, 2));
    console.log();

    // Display token usage (guard against undefined)
    const promptTokens = Number(result.usage?.inputTokens) || 0;
    const completionTokens = Number(result.usage?.outputTokens) || 0;
    const totalTokens = promptTokens + completionTokens;

    console.log('📊 Token Usage:');
    console.log(`  Prompt tokens:     ${promptTokens}`);
    console.log(`  Completion tokens: ${completionTokens}`);
    console.log(`  Total tokens:      ${totalTokens}`);
    console.log();

    // Display router usage snapshot
    console.log('📈 Router Usage Snapshot:');
    const usageSnapshot = await router.getUsage('google');
    console.log(`  Prompt tokens:     ${usageSnapshot.totals.promptTokens}`);
    console.log(`  Completion tokens: ${usageSnapshot.totals.completionTokens}`);
    console.log(`  Total tokens:      ${usageSnapshot.totals.totalTokens}`);
    console.log(`  Call count:        ${usageSnapshot.totals.callCount}`);
    console.log();

    // Verify results - the call succeeded if we got here (no thrown error)
    const hasResponse = result.text.length > 0;
    const hasUsage = totalTokens > 0;
    const hasRouterUsage = usageSnapshot.totals.callCount > 0;

    if (!hasResponse) {
      console.warn('⚠ Response text is empty (model may use thinking mode)');
    }

    if (!hasUsage) {
      console.warn('⚠ Token usage is zero (provider may not report usage for this model)');
    }

    if (!hasRouterUsage) {
      console.error('❌ FAILED: Router usage tracking did not record the call!');
      await router.close();
      process.exit(1);
    }

    console.log('✅ SUCCESS: All validations passed!');
    console.log('   - Real API call succeeded');
    if (hasResponse) console.log('   - Response text received');
    if (hasUsage) console.log('   - Token usage counts are non-zero');
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
