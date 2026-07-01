# files to inspect for security stack audit
$files = @(
  'src/lib/app-modes.ts',
  'src/lib/reindex-pipeline.ts',
  'src/app/api/answer/route.ts',
  'src/app/api/answer/stream/route.ts',
  'src/app/api/documents/[id]/labels/route.ts',
  'src/app/api/documents/[id]/signed-url/route.ts',
  'src/app/api/documents/[id]/table-facts/route.ts',
  'src/app/api/documents/bulk/reindex/route.ts',
  'src/app/api/documents/bulk/route.ts',
  'src/app/api/eval-cases/route.ts',
  'src/app/api/search/interaction/route.ts',
  'src/app/api/search/route.ts'
)
foreach ($rel in $files) {
  $path = Join-Path 'C:\Dev\Apps\Database' $rel
  Write-Output "--- START $rel"
  Get-Content -Path $path
  Write-Output "--- END $rel"
}
