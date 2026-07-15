use std::collections::{BTreeSet, HashMap};
use std::path::{Path, PathBuf};
use std::sync::mpsc::{self, Receiver};
use std::time::{Duration, Instant};

use notify::{Event, RecommendedWatcher, RecursiveMode, Watcher};

pub trait WatcherAdapter {
    fn watch(&mut self, path: &Path) -> Result<(), String>;
    fn poll_debounced(&mut self, timeout: Duration) -> Result<Vec<PathBuf>, String>;
}

pub struct NotifyWatcherAdapter {
    watcher: RecommendedWatcher,
    receiver: Receiver<notify::Result<Event>>,
    debounce: DebounceQueue,
}

impl NotifyWatcherAdapter {
    pub fn new(window: Duration) -> Result<Self, String> {
        let (sender, receiver) = mpsc::channel();
        let watcher = notify::recommended_watcher(move |event| {
            let _ = sender.send(event);
        })
        .map_err(|e| format!("创建文件监听器失败: {e}"))?;
        Ok(Self {
            watcher,
            receiver,
            debounce: DebounceQueue::new(window),
        })
    }
}

impl WatcherAdapter for NotifyWatcherAdapter {
    fn watch(&mut self, path: &Path) -> Result<(), String> {
        self.watcher
            .watch(path, RecursiveMode::Recursive)
            .map_err(|e| format!("监听目录失败 {}: {e}", path.display()))
    }

    fn poll_debounced(&mut self, timeout: Duration) -> Result<Vec<PathBuf>, String> {
        match self.receiver.recv_timeout(timeout) {
            Ok(Ok(event)) => {
                for path in event.paths {
                    self.debounce.push(path, Instant::now());
                }
            }
            Ok(Err(error)) => return Err(format!("文件监听事件失败: {error}")),
            Err(mpsc::RecvTimeoutError::Timeout) => {}
            Err(mpsc::RecvTimeoutError::Disconnected) => return Err("文件监听器已断开".to_string()),
        }
        Ok(self.debounce.drain_ready(Instant::now()))
    }
}

#[derive(Debug)]
pub struct DebounceQueue {
    window: Duration,
    pending: HashMap<PathBuf, Instant>,
}

impl DebounceQueue {
    pub fn new(window: Duration) -> Self {
        Self {
            window,
            pending: HashMap::new(),
        }
    }

    pub fn push(&mut self, path: PathBuf, observed_at: Instant) {
        self.pending.insert(normalize_event_path(path), observed_at);
    }

    pub fn drain_ready(&mut self, now: Instant) -> Vec<PathBuf> {
        let ready = self
            .pending
            .iter()
            .filter_map(|(path, observed_at)| {
                (now.saturating_duration_since(*observed_at) >= self.window).then_some(path.clone())
            })
            .collect::<BTreeSet<_>>();
        self.pending.retain(|path, _| !ready.contains(path));
        ready.into_iter().collect()
    }
}

fn normalize_event_path(path: PathBuf) -> PathBuf {
    if path.file_name().is_some_and(|name| name == "SKILL.md") {
        path.parent().unwrap_or(&path).to_path_buf()
    } else {
        path
    }
}

#[cfg(test)]
mod tests {
    use std::time::{Duration, Instant};

    use super::DebounceQueue;

    #[test]
    fn coalesces_repeated_events_until_debounce_window_elapsed() {
        let start = Instant::now();
        let mut queue = DebounceQueue::new(Duration::from_millis(250));
        queue.push("demo/SKILL.md".into(), start);
        queue.push("demo/SKILL.md".into(), start + Duration::from_millis(100));
        assert!(queue
            .drain_ready(start + Duration::from_millis(200))
            .is_empty());
        assert_eq!(
            queue.drain_ready(start + Duration::from_millis(400)),
            vec![std::path::PathBuf::from("demo")]
        );
    }
}
