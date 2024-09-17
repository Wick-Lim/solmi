import { Box, BoxProps } from "@mui/material";
import { FC, forwardRef } from "react";

interface RowProps extends BoxProps {}

const Row: FC<RowProps> = forwardRef((props, ref) => (
  <Box display="flex" flexDirection="row" ref={ref} {...props} />
)) as FC<RowProps>;

export default Row;
