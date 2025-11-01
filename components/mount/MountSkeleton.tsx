import React from "react";
import {Skeleton, SkeletonText} from "@/components/ui/skeleton";
import {Box} from "@/components/ui/box";
import {HStack} from "@/components/ui/hstack";

export function MountSkeletonCard() {
  return (
    <Box className="w-full max-w-[360px] gap-4 p-3 rounded-md bg-background-100">
      <Skeleton variant="sharp" className="h-[100px] w-full" />
      <SkeletonText _lines={3} className="h-2" />
      <HStack className="gap-1 align-middle">
        <Skeleton variant="circular" className="h-[24px] w-[28px] mr-2" />
        <SkeletonText _lines={2} gap={1} className="h-2 w-2/5" />
      </HStack>
    </Box>
  );
}

export function MountSkeletonGrid({count = 4}: {count?: number}) {
  return (
    <>
      {Array.from({length: count}).map((_, index) => (
        <MountSkeletonCard key={`mount-skeleton-${index}`} />
      ))}
    </>
  );
}
