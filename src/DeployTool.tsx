import { Container } from "@sanity/ui";
import type { Tool } from "sanity";
import { DeployHistory } from "./components/DeployHistory";
import type { DeployToolOptions } from "./types";

export function DeployTool({ tool }: { tool: Tool }) {
  const { github, githubToken, documentTypes, titleField } =
    tool.options as DeployToolOptions;

  return (
    <Container width={2} padding={4}>
      <DeployHistory
        github={github}
        githubToken={githubToken}
        documentTypes={documentTypes}
        titleField={titleField}
      />
    </Container>
  );
}
