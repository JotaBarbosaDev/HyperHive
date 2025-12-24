import {CompressionOption} from "@/types/btrfs";

export const COMPRESSION_OPTIONS: CompressionOption[] = [
  {value: "", label: "None", description: "Sem compressao (padrao)"},
  {value: "lzo", label: "LZO", description: "Rapido, razao moderada"},
  {value: "zlib", label: "Zlib", description: "Maior compressao, mais lento"},
  {value: "zlib:1", label: "Zlib 1", description: "Zlib mais rapido"},
  {value: "zlib:3", label: "Zlib 3", description: "Zlib default"},
  {value: "zlib:9", label: "Zlib 9", description: "Compressao maxima zlib"},
  {value: "zstd", label: "ZSTD", description: "Equilibrio recomendado"},
  {value: "zstd:1", label: "ZSTD 1", description: "Zstd mais rapido"},
  {value: "zstd:3", label: "ZSTD 3", description: "Zstd default recomendado"},
  {value: "zstd:9", label: "ZSTD 9", description: "Compressao alta"},
  {value: "zstd:15", label: "ZSTD 15", description: "Compressao maxima zstd"},
];

export const RAID_LEVEL_OPTIONS = [
  {value: "raid0", label: "RAID0", minDisks: 2},
  {value: "raid1", label: "RAID1", minDisks: 2},
  {value: "raid1c3", label: "RAID1C3", minDisks: 3},
  {value: "raid1c4", label: "RAID1C4", minDisks: 4},
  {value: "single", label: "SINGLE", minDisks: 1},
  {value: "dup", label: "DUP", minDisks: 1},
  {value: "raid5", label: "RAID5", minDisks: 3},
  {value: "raid6", label: "RAID6", minDisks: 4},
];
