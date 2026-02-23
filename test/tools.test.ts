import { createTools } from "../src/tools";
import { assertOperationAllowed } from "../src/guards";
import { PluginConfig } from "../src/types";

function baseConfig(): PluginConfig {
  return {
    socketPath: "/var/run/docker.sock",
    readOnly: false,
    allowedOperations: undefined,
    composeProjects: [],
    timeoutMs: 15000
  };
}

describe("docker tools", () => {
  test("docker_ps returns normalized container list", async () => {
    const docker = {
      listContainers: jest.fn().mockResolvedValue([
        {
          Id: "abc",
          Names: ["/web"],
          Image: "nginx:latest",
          State: "running",
          Status: "Up 1 minute"
        }
      ])
    } as unknown as Parameters<typeof createTools>[0]["docker"];

    const tools = createTools({ docker, config: baseConfig() });
    const result = (await tools.docker_ps({ all: true })) as Array<Record<string, string>>;

    expect(result[0]).toEqual({
      id: "abc",
      name: "web",
      image: "nginx:latest",
      state: "running",
      status: "Up 1 minute"
    });
  });

  test("docker_logs returns text logs", async () => {
    const docker = {
      getContainer: jest.fn().mockReturnValue({
        logs: jest.fn().mockResolvedValue(Buffer.from("hello\nworld"))
      })
    } as unknown as Parameters<typeof createTools>[0]["docker"];

    const tools = createTools({ docker, config: baseConfig() });
    const result = (await tools.docker_logs({ containerId: "abc", tail: 20 })) as Record<
      string,
      unknown
    >;

    expect(result.logs).toContain("hello");
  });

  test("docker_inspect returns payload", async () => {
    const docker = {
      getContainer: jest.fn().mockReturnValue({
        inspect: jest.fn().mockResolvedValue({ Id: "abc", Config: { Image: "redis" } })
      })
    } as unknown as Parameters<typeof createTools>[0]["docker"];

    const tools = createTools({ docker, config: baseConfig() });
    const result = (await tools.docker_inspect({ containerId: "abc" })) as { Id: string };

    expect(result.Id).toBe("abc");
  });
});

describe("allowedOperations guard", () => {
  test("blocks write operations in readOnly mode", () => {
    const config: PluginConfig = {
      ...baseConfig(),
      readOnly: true
    };

    expect(() => assertOperationAllowed("start", config)).toThrow(/readOnly/);
    expect(() => assertOperationAllowed("ps", config)).not.toThrow();
  });

  test("blocks non-whitelisted operation", () => {
    const config: PluginConfig = {
      ...baseConfig(),
      allowedOperations: ["ps", "inspect"]
    };

    expect(() => assertOperationAllowed("logs", config)).toThrow(/allowedOperations/);
  });
});
