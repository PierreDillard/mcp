/** Simple query expansion: basic synonym substitution */

// Simple synonym map
const SYNONYMS: Record<string, string[]> = {
  compress: ["reduce", "optimize", "smaller", "rescale", "scale", "crop", "box_compression"],
  bitrate: ["bandwidth", "rate", "b", "Maxrate", "TargetRate", "DownloadRate", "max_bw", "min_bw"],
  encode: ["transcode", "convert", "enc", "ffenc", "resampler", "tx3g2srt", "ttml2srt"],
  dash: ["segment", "adaptive", "dasher", "dashin", "MPD", "HLS", "ABR", "live", "dynamic"],
  mux: ["merge", "combine", "add", "multiplexer", "mp4mx", "m2tsmx", "ffmx", "gsfmx", "avimx", "oggmx", "bsagg", "tileagg", "remultiplex"],
  encrypt: ["protection", "drm", "cecrypt", "cdcrypt", "CENC", "ProtectionScheme", "PSSH", "CryptInfo", "DecryptInfo", "gcryp"],
};

/**
 * Expand query by replacing words with simple synonyms
 * Returns: original query + 2-3 variants
 */
export function expandQuery(query: string): string[] {
  const words = query.toLowerCase().split(/\s+/).filter(word => word.length > 2);
  const variants: string[] = [query];

  // Generate 1-2 variants by swapping first matchable word
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    if (SYNONYMS[word]) {
      const synonym = SYNONYMS[word][0];
      const variant = [...words];
      variant[i] = synonym;
      variants.push(variant.join(" "));
      if (variants.length >= 3) break;
    }
  }

  return variants;
}
