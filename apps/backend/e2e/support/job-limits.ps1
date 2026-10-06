# Prints, as JSON, the limits of the Windows job the calling process runs in: what a run's own process is held to.
# A run's commands run in its job, so a run executing this reports the limits procgov placed on it.
Add-Type -Namespace MomentumE2e -Name Job -MemberDefinition @'
[DllImport("kernel32.dll")] public static extern bool IsProcessInJob(IntPtr process, IntPtr job, out bool result);
[DllImport("kernel32.dll")] public static extern bool QueryInformationJobObject(IntPtr job, int infoClass, byte[] info, int length, IntPtr returned);
[DllImport("kernel32.dll")] public static extern IntPtr GetCurrentProcess();
'@
$inJob = $false
[void][MomentumE2e.Job]::IsProcessInJob([MomentumE2e.Job]::GetCurrentProcess(), [IntPtr]::Zero, [ref]$inJob)
# JOBOBJECT_EXTENDED_LIMIT_INFORMATION (class 9), 64-bit layout
$info = New-Object byte[] 144
$read = [MomentumE2e.Job]::QueryInformationJobObject([IntPtr]::Zero, 9, $info, 144, [IntPtr]::Zero)
$flags = [BitConverter]::ToUInt32($info, 16)
$affinity = [BitConverter]::ToUInt64($info, 48)
$cores = 0
for ($m = $affinity; $m -ne 0; $m = $m -shr 1) { if ($m -band 1) { $cores++ } }
# JOBOBJECT_CPU_RATE_CONTROL_INFORMATION (class 15)
$rate = New-Object byte[] 8
$rateRead = [MomentumE2e.Job]::QueryInformationJobObject([IntPtr]::Zero, 15, $rate, 8, [IntPtr]::Zero)
[ordered]@{
  inJob = $inJob
  read = $read
  flags = ("0x{0:X}" -f $flags)
  jobMemoryLimited = [bool]($flags -band 0x200)
  jobMemoryLimit = [BitConverter]::ToUInt64($info, 120)
  affinityLimited = [bool]($flags -band 0x10)
  cores = $cores
  cpuRateFlags = if ($rateRead) { [BitConverter]::ToUInt32($rate, 0) } else { 0 }
  cpuRate = if ($rateRead) { [BitConverter]::ToUInt32($rate, 4) } else { 0 }
} | ConvertTo-Json -Compress
