use std::fs::{self, File};
use std::io::{BufWriter, Write};
use std::path::{Path, PathBuf};

pub struct AudioCacheWriter {
    path: PathBuf,
    writer: BufWriter<File>,
    bytes_written: u64,
}

impl AudioCacheWriter {
    pub fn create<P: AsRef<Path>>(path: P) -> Result<Self, String> {
        let path = path.as_ref().to_path_buf();
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|err| format!("Failed to create cache directory: {err}"))?;
        }

        let file =
            File::create(&path).map_err(|err| format!("Failed to prepare cache file: {err}"))?;

        Ok(Self {
            path,
            writer: BufWriter::new(file),
            bytes_written: 0,
        })
    }

    pub fn write_chunk(&mut self, chunk: &[u8]) -> Result<(), String> {
        self.writer
            .write_all(chunk)
            .map_err(|err| format!("Failed to write audio chunk: {err}"))?;
        self.bytes_written += chunk.len() as u64;
        Ok(())
    }

    pub fn finalize(mut self) -> Result<(String, u64), String> {
        self.writer
            .flush()
            .map_err(|err| format!("Failed to flush cached audio: {err}"))?;
        let path = self.path.to_string_lossy().to_string();
        Ok((path, self.bytes_written))
    }
}
