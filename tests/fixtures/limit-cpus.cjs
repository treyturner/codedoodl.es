// Test-only preload: Node 10 counts host CPUs, ignoring container CPU quotas.
// Keep the real npm start/cluster path, but bound it to one worker per fixture.
// This file is mounted read-only and is never copied into the application image.
var os = require('os');
var cpu = os.cpus()[0];
os.cpus = function () { return [cpu]; };
