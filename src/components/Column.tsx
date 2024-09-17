import { Box, BoxProps } from "@mui/material";
import { FC, forwardRef } from "react";

interface ColumnProps extends BoxProps {}

const Column: FC<ColumnProps> = forwardRef((props, ref) => (
  <Box display="flex" flexDirection="column" ref={ref} {...props} />
)) as FC<ColumnProps>;

export default Column;
