mod adapter;
mod registry;

pub use adapter::{
    DetectionResult, DirectoryPlatformAdapter, PlatformAdapter, PlatformContext, PlatformError,
    SymlinkCapability,
};
pub use registry::PlatformRegistry;
