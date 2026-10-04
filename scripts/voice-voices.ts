/**
 * Lists the voices available on the Retell account, to pick RETELL_VOICE_ID.
 *
 *   pnpm voice:voices [--provider elevenlabs|cartesia|openai|...]
 *
 * Retell's voice list carries no language field; Turkish works with the
 * multilingual providers (ElevenLabs, Cartesia, OpenAI, MiniMax, Fish Audio).
 * Listen to the preview before choosing.
 */
import { config } from "dotenv";

import { retellClient } from "@/server/voice/providers/retell/config";

config({ path: [".env.local", ".env"], quiet: true });

async function main() {
  const index = process.argv.indexOf("--provider");
  const provider = index > -1 ? process.argv[index + 1] : undefined;

  const voices = (await retellClient().voice.list())
    .filter((voice) => !provider || voice.provider === provider)
    .sort(
      (a, b) => a.provider.localeCompare(b.provider) || a.voice_name.localeCompare(b.voice_name),
    );

  for (const voice of voices) {
    const traits = [voice.gender, voice.accent, voice.age].filter(Boolean).join(", ");
    console.info(
      `${voice.voice_id.padEnd(36)} ${voice.provider.padEnd(11)} ${voice.voice_name} (${traits})`,
    );
    if (voice.preview_audio_url) console.info(`${"".padEnd(48)}${voice.preview_audio_url}`);
  }
  console.info(`\n${voices.length} voices. Put the chosen id in .env.local as RETELL_VOICE_ID.`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
