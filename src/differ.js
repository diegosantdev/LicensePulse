const fs = require('fs').promises;
const path = require('path');

function getSnapshotsDir() {
  return process.env.LICENSEPULSE_SNAPSHOTS_DIR || '.licensepulse/snapshots';
}

function getSnapshotFilename(repoId) {
  return repoId.replace('/', '-') + '.json';
}

function getSnapshotPath(repoId) {
  return path.join(getSnapshotsDir(), getSnapshotFilename(repoId));
}

async function ensureSnapshotsDir() {
  try {
    const path = require('path');
    const dir = getSnapshotsDir();
    const baseDir = path.dirname(dir);
    await fs.mkdir(baseDir, { recursive: true });
    await fs.mkdir(dir, { recursive: true });
  } catch (error) {
    // Ignore errors if directory already exists
  }
}

async function loadSnapshot(repoId) {
  try {
    const snapshotPath = getSnapshotPath(repoId);
    const data = await fs.readFile(snapshotPath, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw new Error(`Failed to load snapshot for ${repoId}: ${error.message}`);
  }
}

async function saveSnapshot(repoId, licenseData) {
  try {
    await ensureSnapshotsDir();

    const snapshot = {
      repo: repoId,
      spdxId: licenseData.spdxId,
      timestamp: licenseData.timestamp || new Date().toISOString(),
      ...(licenseData.previousSpdxId && { previousSpdxId: licenseData.previousSpdxId }),
      ...(licenseData.changedAt && { changedAt: licenseData.changedAt })
    };

    const snapshotPath = getSnapshotPath(repoId);
    await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf8');
  } catch (error) {
    throw new Error(`Failed to save snapshot for ${repoId}: ${error.message}`);
  }
}

async function getAllSnapshots() {
  try {
    await ensureSnapshotsDir();
    const dir = getSnapshotsDir();
    const files = await fs.readdir(dir);

    const snapshots = [];
    for (const file of files) {
      if (file.endsWith('.json')) {
        const filePath = path.join(dir, file);
        const data = await fs.readFile(filePath, 'utf8');
        snapshots.push(JSON.parse(data));
      }
    }

    return snapshots;
  } catch (error) {
    throw new Error(`Failed to get all snapshots: ${error.message}`);
  }
}

function detectChange(snapshot, currentLicense) {

  if (!snapshot) {
    return null;
  }

  if (snapshot.spdxId !== currentLicense.spdxId) {
    return {
      changed: true,
      oldLicense: snapshot.spdxId,
      newLicense: currentLicense.spdxId
    };
  }

  return null;
}

async function checkAndUpdate(repoId, currentLicense) {

  const snapshot = await loadSnapshot(repoId);

  if (!snapshot) {
    await saveSnapshot(repoId, {
      spdxId: currentLicense.spdxId,
      timestamp: currentLicense.fetchedAt || new Date().toISOString()
    });

    return { changed: false };
  }

  const change = detectChange(snapshot, currentLicense);

  if (change) {
    await saveSnapshot(repoId, {
      spdxId: currentLicense.spdxId,
      timestamp: currentLicense.fetchedAt || new Date().toISOString(),
      previousSpdxId: snapshot.spdxId,
      changedAt: currentLicense.fetchedAt || new Date().toISOString()
    });

    return {
      changed: true,
      oldLicense: change.oldLicense,
      newLicense: change.newLicense
    };
  }

  return { changed: false };
}

module.exports = {
  loadSnapshot,
  saveSnapshot,
  getAllSnapshots,
  detectChange,
  checkAndUpdate,
  getSnapshotFilename,
  getSnapshotPath
};
