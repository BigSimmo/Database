import { Pagination } from "prompt-for-codex-medical-knowledge-base";

export const Short = () => (
  <div className="w-[34rem]">
    <Pagination page={2} pageCount={4} onPageChange={() => {}} summary="21–40 of 78 sources" />
  </div>
);

export const Truncated = () => (
  <div className="w-[34rem]">
    <Pagination page={9} pageCount={42} onPageChange={() => {}} summary="161–180 of 831 sources" />
  </div>
);

export const FirstPage = () => (
  <div className="w-[34rem]">
    <Pagination page={1} pageCount={42} onPageChange={() => {}} />
  </div>
);
