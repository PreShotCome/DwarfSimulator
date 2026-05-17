use serde::Deserialize;

/// A unit of work received from the pool.
#[derive(Debug, Clone, Deserialize)]
pub struct Job {
    pub job_id: String,
    pub blob: String,
    pub target: String,
    #[serde(default)]
    pub seed_hash: String,
    #[serde(default)]
    pub height: u64,
}

/// Byte offset of the 4-byte nonce inside a Monero block hashing blob.
pub const NONCE_OFFSET: usize = 39;

/// Parse a stratum target (little-endian hex, 4 or 8 bytes) into a 64-bit
/// target value. A hash is a valid share when its most-significant 64-bit
/// word is below this number.
pub fn target_to_u64(target_hex: &str) -> anyhow::Result<u64> {
    let bytes = hex::decode(target_hex.trim())?;
    match bytes.len() {
        4 => {
            let t = u32::from_le_bytes([bytes[0], bytes[1], bytes[2], bytes[3]]);
            if t == 0 {
                anyhow::bail!("zero target");
            }
            // Standard Monero short-target expansion to 64 bits.
            Ok(u64::MAX / (u32::MAX as u64 / t as u64).max(1))
        }
        8 => Ok(u64::from_le_bytes(bytes.try_into().unwrap())),
        n => anyhow::bail!("unexpected target byte length: {n}"),
    }
}

/// RandomX hashes are compared little-endian; the trailing 8 bytes form the
/// most-significant word.
pub fn hash_meets_target(hash: &[u8], target: u64) -> bool {
    if hash.len() != 32 {
        return false;
    }
    let high = u64::from_le_bytes(hash[24..32].try_into().unwrap());
    high < target
}

/// Difficulty implied by a 64-bit target, for display purposes.
pub fn target_difficulty(target: u64) -> u64 {
    if target == 0 {
        0
    } else {
        u64::MAX / target
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn four_byte_target_max() {
        assert_eq!(target_to_u64("ffffffff").unwrap(), u64::MAX);
    }

    #[test]
    fn eight_byte_target_is_little_endian() {
        assert_eq!(
            target_to_u64("00000000ffffffff").unwrap(),
            0xffff_ffff_0000_0000
        );
    }

    #[test]
    fn lower_difficulty_means_larger_target() {
        // 0x7fffffff is half of 0xffffffff -> harder -> smaller 64-bit target.
        let easy = target_to_u64("ffffffff").unwrap();
        let hard = target_to_u64("ffffff7f").unwrap();
        assert!(easy > hard);
    }

    #[test]
    fn zero_target_rejected() {
        assert!(target_to_u64("00000000").is_err());
    }

    #[test]
    fn target_match_logic() {
        let mut hash = [0u8; 32];
        assert!(hash_meets_target(&hash, 1));
        hash[31] = 0xff;
        assert!(!hash_meets_target(&hash, 1));
        assert!(!hash_meets_target(&[0u8; 16], 1));
    }

    #[test]
    fn difficulty_roundtrip() {
        let target = target_to_u64("ffffff7f").unwrap();
        assert_eq!(target_difficulty(target), 2);
    }
}
