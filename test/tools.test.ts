import { PassThrough } from "node:stream";
import { createTools } from "../src/tools";
import { assertOperationAllowed } from "../src/guards";
import { PluginConfig } from "../src/types";
import { vi } from 'vitest'

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
      listContainers: vi.fn().mockResolvedValue([
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
      getContainer: vi.fn().mockReturnValue({
        logs: vi.fn().mockResolvedValue(Buffer.from("hello\nworld"))
      })
    } as unknown as Parameters<typeof createTools>[0]["docker"];

    const tools = createTools({ docker, config: baseConfig() });
    const result = (await tools.docker_logs({ containerId: "abc", tail: 20 })) as Record<
      string,
      unknown
    >;

    expect(result.logs).toContain("hello");
  });

  test("docker_logs follow mode collects streamed data", async () => {
    const mockStream = new PassThrough();
    const docker = {
      getContainer: vi.fn().mockReturnValue({
        logs: vi.fn().mockResolvedValue(mockStream)
      })
    } as unknown as Parameters<typeof createTools>[0]["docker"];

    const tools = createTools({ docker, config: baseConfig() });

    setTimeout(() => {
      mockStream.write(Buffer.from("line1\n"));
      mockStream.write(Buffer.from("line2\n"));
      mockStream.end();
    }, 10);

    const result = (await tools.docker_logs({
      containerId: "abc",
      follow: true,
      followDurationMs: 5000
    })) as Record<string, unknown>;

    expect(result.follow).toBe(true);
    expect(result.logs).toContain("line1");
    expect(result.logs).toContain("line2");
  });

  test("docker_logs follow mode respects duration limit", async () => {
    const mockStream = new PassThrough();
    const docker = {
      getContainer: vi.fn().mockReturnValue({
        logs: vi.fn().mockResolvedValue(mockStream)
      })
    } as unknown as Parameters<typeof createTools>[0]["docker"];

    const tools = createTools({ docker, config: baseConfig() });

    mockStream.write(Buffer.from("initial\n"));

    const result = (await tools.docker_logs({
      containerId: "abc",
      follow: true,
      followDurationMs: 100
    })) as Record<string, unknown>;

    expect(result.follow).toBe(true);
    expect(result.durationMs).toBe(100);
    expect(result.logs).toContain("initial");
  });

  test("docker_inspect returns payload", async () => {
    const docker = {
      getContainer: vi.fn().mockReturnValue({
        inspect: vi.fn().mockResolvedValue({ Id: "abc", Config: { Image: "redis" } })
      })
    } as unknown as Parameters<typeof createTools>[0]["docker"];

    const tools = createTools({ docker, config: baseConfig() });
    const result = (await tools.docker_inspect({ containerId: "abc" })) as { Id: string };

    expect(result.Id).toBe("abc");
  });

  test("docker_exec runs command and returns stdout/stderr", async () => {
    const execStream = new PassThrough();
    const mockExec = {
      start: vi.fn().mockResolvedValue(execStream),
      inspect: vi.fn().mockResolvedValue({ ExitCode: 0 })
    };
    const mockModem = {
      demuxStream: vi.fn((stream: PassThrough, stdout: PassThrough, _stderr: PassThrough) => {
        stream.on("data", (chunk: Buffer) => stdout.write(chunk));
        stream.on("end", () => stdout.end());
      })
    };
    const docker = {
      getContainer: vi.fn().mockReturnValue({
        exec: vi.fn().mockResolvedValue(mockExec)
      }),
      modem: mockModem
    } as unknown as Parameters<typeof createTools>[0]["docker"];

    const tools = createTools({ docker, config: baseConfig() });

    setTimeout(() => {
      execStream.write(Buffer.from("hello from exec\n"));
      execStream.end();
    }, 10);

    const result = (await tools.docker_exec({
      containerId: "abc",
      command: ["echo", "hello from exec"]
    })) as Record<string, unknown>;

    expect(result.ok).toBe(true);
    expect(result.action).toBe("exec");
    expect(result.containerId).toBe("abc");
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toContain("hello from exec");
  });

  test("docker_exec passes workdir and env options", async () => {
    const execStream = new PassThrough();
    const mockExec = {
      start: vi.fn().mockResolvedValue(execStream),
      inspect: vi.fn().mockResolvedValue({ ExitCode: 0 })
    };
    const containerObj = {
      exec: vi.fn().mockResolvedValue(mockExec)
    };
    const docker = {
      getContainer: vi.fn().mockReturnValue(containerObj),
      modem: {
        demuxStream: vi.fn((_stream: PassThrough, stdout: PassThrough, _stderr: PassThrough) => {
          // Pipe the exec stream into stdout so end propagates
          _stream.pipe(stdout);
        })
      }
    } as unknown as Parameters<typeof createTools>[0]["docker"];

    const tools = createTools({ docker, config: baseConfig() });

    // End the stream after a tick so the promise listener is registered first
    setTimeout(() => execStream.end(), 10);

    await tools.docker_exec({
      containerId: "abc",
      command: ["ls", "-la"],
      workdir: "/app",
      env: ["FOO=bar"]
    });

    expect(containerObj.exec).toHaveBeenCalledWith(
      expect.objectContaining({
        Cmd: ["ls", "-la"],
        WorkingDir: "/app",
        Env: ["FOO=bar"]
      })
    );
  });

  test("docker_exec is blocked in readOnly mode", async () => {
    const docker = {} as Parameters<typeof createTools>[0]["docker"];
    const config: PluginConfig = { ...baseConfig(), readOnly: true };
    const tools = createTools({ docker, config });

    await expect(
      tools.docker_exec({ containerId: "abc", command: ["ls"] })
    ).rejects.toThrow(/readOnly/);
  });

  test("docker_exec throws when command is empty", async () => {
    const docker = {} as Parameters<typeof createTools>[0]["docker"];
    const tools = createTools({ docker, config: baseConfig() });

    await expect(
      tools.docker_exec({ containerId: "abc", command: [] })
    ).rejects.toThrow(/non-empty/);
  });
});

describe("docker_compose_ps", () => {
  function composeConfig(): PluginConfig {
    return {
      ...baseConfig(),
      composeProjects: [{ name: "myapp", path: "/opt/myapp" }]
    };
  }

  test("returns parsed service list from compose ps JSON output", async () => {
    const jsonLine1 = JSON.stringify({ Name: "myapp-web-1", State: "running", Service: "web" });
    const jsonLine2 = JSON.stringify({ Name: "myapp-db-1", State: "running", Service: "db" });
    const mockRunner = vi.fn().mockResolvedValue({
      stdout: `${jsonLine1}\n${jsonLine2}\n`,
      stderr: ""
    });

    const docker = {} as Parameters<typeof createTools>[0]["docker"];
    const tools = createTools({ docker, config: composeConfig(), composeRunner: mockRunner });
    const result = (await tools.docker_compose_ps({ project: "myapp" })) as {
      ok: boolean;
      action: string;
      project: string;
      services: Array<{ Name: string; State: string; Service: string }>;
    };

    expect(result.ok).toBe(true);
    expect(result.action).toBe("compose_ps");
    expect(result.project).toBe("myapp");
    expect(result.services).toHaveLength(2);
    expect(result.services[0]).toEqual({ Name: "myapp-web-1", State: "running", Service: "web" });
    expect(result.services[1]).toEqual({ Name: "myapp-db-1", State: "running", Service: "db" });
    expect(mockRunner).toHaveBeenCalledWith("/opt/myapp", ["ps", "--format", "json"], 15000);
  });

  test("returns empty services array when no containers are running", async () => {
    const mockRunner = vi.fn().mockResolvedValue({ stdout: "", stderr: "" });

    const docker = {} as Parameters<typeof createTools>[0]["docker"];
    const tools = createTools({ docker, config: composeConfig(), composeRunner: mockRunner });
    const result = (await tools.docker_compose_ps({ project: "myapp" })) as {
      services: unknown[];
    };

    expect(result.services).toEqual([]);
  });

  test("passes service filter arguments to compose command", async () => {
    const mockRunner = vi.fn().mockResolvedValue({ stdout: "", stderr: "" });

    const docker = {} as Parameters<typeof createTools>[0]["docker"];
    const tools = createTools({ docker, config: composeConfig(), composeRunner: mockRunner });
    await tools.docker_compose_ps({ project: "myapp", services: ["web"] });

    expect(mockRunner).toHaveBeenCalledWith("/opt/myapp", ["ps", "--format", "json", "web"], 15000);
  });

  test("is allowed in readOnly mode", () => {
    const config: PluginConfig = { ...baseConfig(), readOnly: true };
    expect(() => assertOperationAllowed("compose_ps", config)).not.toThrow();
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

// ──────────────────────────────────────────────────────────────────────────────
// T-006: Write-operation unit tests
// ──────────────────────────────────────────────────────────────────────────────

describe("docker_start", () => {
  test("calls container.start() and returns ok shape", async () => {
    const mockStart = vi.fn().mockResolvedValue(undefined);
    const docker = {
      getContainer: vi.fn().mockReturnValue({ start: mockStart })
    } as unknown as Parameters<typeof createTools>[0]["docker"];

    const tools = createTools({ docker, config: baseConfig() });
    const result = (await tools.docker_start({ containerId: "abc123" })) as Record<string, unknown>;

    expect(mockStart).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ ok: true, action: "start", containerId: "abc123" });
  });

  test("is blocked in readOnly mode", async () => {
    const docker = {} as Parameters<typeof createTools>[0]["docker"];
    const config: PluginConfig = { ...baseConfig(), readOnly: true };
    const tools = createTools({ docker, config });

    await expect(tools.docker_start({ containerId: "abc" })).rejects.toThrow(/readOnly/);
  });

  test("calls guard before container interaction", async () => {
    const docker = {
      getContainer: vi.fn().mockReturnValue({ start: vi.fn().mockResolvedValue(undefined) })
    } as unknown as Parameters<typeof createTools>[0]["docker"];

    const config: PluginConfig = { ...baseConfig(), allowedOperations: ["ps"] };
    const tools = createTools({ docker, config });

    // guard should fire before getContainer is even called
    await expect(tools.docker_start({ containerId: "abc" })).rejects.toThrow(/allowedOperations/);
    expect((docker.getContainer as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  test("propagates Docker API errors", async () => {
    const docker = {
      getContainer: vi.fn().mockReturnValue({
        start: vi.fn().mockRejectedValue(new Error("container already running"))
      })
    } as unknown as Parameters<typeof createTools>[0]["docker"];

    const tools = createTools({ docker, config: baseConfig() });
    await expect(tools.docker_start({ containerId: "abc" })).rejects.toThrow(/container already running/);
  });
});

describe("docker_stop", () => {
  test("calls container.stop() with default timeout and returns ok shape", async () => {
    const mockStop = vi.fn().mockResolvedValue(undefined);
    const docker = {
      getContainer: vi.fn().mockReturnValue({ stop: mockStop })
    } as unknown as Parameters<typeof createTools>[0]["docker"];

    const tools = createTools({ docker, config: baseConfig() });
    const result = (await tools.docker_stop({ containerId: "abc123" })) as Record<string, unknown>;

    expect(mockStop).toHaveBeenCalledWith({ t: 10 });
    expect(result).toEqual({ ok: true, action: "stop", containerId: "abc123" });
  });

  test("passes custom timeout to container.stop()", async () => {
    const mockStop = vi.fn().mockResolvedValue(undefined);
    const docker = {
      getContainer: vi.fn().mockReturnValue({ stop: mockStop })
    } as unknown as Parameters<typeof createTools>[0]["docker"];

    const tools = createTools({ docker, config: baseConfig() });
    await tools.docker_stop({ containerId: "abc", timeout: 30 });

    expect(mockStop).toHaveBeenCalledWith({ t: 30 });
  });

  test("is blocked in readOnly mode", async () => {
    const docker = {} as Parameters<typeof createTools>[0]["docker"];
    const config: PluginConfig = { ...baseConfig(), readOnly: true };
    const tools = createTools({ docker, config });

    await expect(tools.docker_stop({ containerId: "abc" })).rejects.toThrow(/readOnly/);
  });

  test("propagates Docker API errors", async () => {
    const docker = {
      getContainer: vi.fn().mockReturnValue({
        stop: vi.fn().mockRejectedValue(new Error("container not running"))
      })
    } as unknown as Parameters<typeof createTools>[0]["docker"];

    const tools = createTools({ docker, config: baseConfig() });
    await expect(tools.docker_stop({ containerId: "abc" })).rejects.toThrow(/container not running/);
  });
});

describe("docker_restart", () => {
  test("calls container.restart() with default timeout and returns ok shape", async () => {
    const mockRestart = vi.fn().mockResolvedValue(undefined);
    const docker = {
      getContainer: vi.fn().mockReturnValue({ restart: mockRestart })
    } as unknown as Parameters<typeof createTools>[0]["docker"];

    const tools = createTools({ docker, config: baseConfig() });
    const result = (await tools.docker_restart({ containerId: "abc123" })) as Record<string, unknown>;

    expect(mockRestart).toHaveBeenCalledWith({ t: 10 });
    expect(result).toEqual({ ok: true, action: "restart", containerId: "abc123" });
  });

  test("passes custom timeout to container.restart()", async () => {
    const mockRestart = vi.fn().mockResolvedValue(undefined);
    const docker = {
      getContainer: vi.fn().mockReturnValue({ restart: mockRestart })
    } as unknown as Parameters<typeof createTools>[0]["docker"];

    const tools = createTools({ docker, config: baseConfig() });
    await tools.docker_restart({ containerId: "abc", timeout: 5 });

    expect(mockRestart).toHaveBeenCalledWith({ t: 5 });
  });

  test("is blocked in readOnly mode", async () => {
    const docker = {} as Parameters<typeof createTools>[0]["docker"];
    const config: PluginConfig = { ...baseConfig(), readOnly: true };
    const tools = createTools({ docker, config });

    await expect(tools.docker_restart({ containerId: "abc" })).rejects.toThrow(/readOnly/);
  });

  test("propagates Docker API errors", async () => {
    const docker = {
      getContainer: vi.fn().mockReturnValue({
        restart: vi.fn().mockRejectedValue(new Error("daemon unavailable"))
      })
    } as unknown as Parameters<typeof createTools>[0]["docker"];

    const tools = createTools({ docker, config: baseConfig() });
    await expect(tools.docker_restart({ containerId: "abc" })).rejects.toThrow(/daemon unavailable/);
  });
});

describe("docker_compose_up", () => {
  function composeConfig(): PluginConfig {
    return {
      ...baseConfig(),
      composeProjects: [{ name: "myapp", path: "/opt/myapp" }]
    };
  }

  test("calls compose runner with up -d args and returns ok shape", async () => {
    const mockRunner = vi.fn().mockResolvedValue({ stdout: "", stderr: "" });
    const docker = {} as Parameters<typeof createTools>[0]["docker"];
    const tools = createTools({ docker, config: composeConfig(), composeRunner: mockRunner });

    const result = (await tools.docker_compose_up({ project: "myapp" })) as Record<string, unknown>;

    expect(mockRunner).toHaveBeenCalledWith("/opt/myapp", ["up", "-d"], 15000);
    expect(result.ok).toBe(true);
    expect(result.action).toBe("compose_up");
    expect(result.project).toBe("myapp");
  });

  test("omits -d when detached is false", async () => {
    const mockRunner = vi.fn().mockResolvedValue({ stdout: "", stderr: "" });
    const docker = {} as Parameters<typeof createTools>[0]["docker"];
    const tools = createTools({ docker, config: composeConfig(), composeRunner: mockRunner });

    await tools.docker_compose_up({ project: "myapp", detached: false });

    expect(mockRunner).toHaveBeenCalledWith("/opt/myapp", ["up"], 15000);
  });

  test("is blocked in readOnly mode", async () => {
    const mockRunner = vi.fn();
    const docker = {} as Parameters<typeof createTools>[0]["docker"];
    const config: PluginConfig = { ...composeConfig(), readOnly: true };
    const tools = createTools({ docker, config, composeRunner: mockRunner });

    await expect(tools.docker_compose_up({ project: "myapp" })).rejects.toThrow(/readOnly/);
    expect(mockRunner).not.toHaveBeenCalled();
  });

  test("throws when project is unknown", async () => {
    const mockRunner = vi.fn();
    const docker = {} as Parameters<typeof createTools>[0]["docker"];
    const tools = createTools({ docker, config: composeConfig(), composeRunner: mockRunner });

    await expect(tools.docker_compose_up({ project: "unknown" })).rejects.toThrow(/Unknown compose project/);
  });
});

describe("docker_compose_down", () => {
  function composeConfig(): PluginConfig {
    return {
      ...baseConfig(),
      composeProjects: [{ name: "myapp", path: "/opt/myapp" }]
    };
  }

  test("calls compose runner with down args and returns ok shape", async () => {
    const mockRunner = vi.fn().mockResolvedValue({ stdout: "", stderr: "" });
    const docker = {} as Parameters<typeof createTools>[0]["docker"];
    const tools = createTools({ docker, config: composeConfig(), composeRunner: mockRunner });

    const result = (await tools.docker_compose_down({ project: "myapp" })) as Record<string, unknown>;

    expect(mockRunner).toHaveBeenCalledWith("/opt/myapp", ["down"], 15000);
    expect(result.ok).toBe(true);
    expect(result.action).toBe("compose_down");
    expect(result.project).toBe("myapp");
  });

  test("appends --volumes when volumes: true", async () => {
    const mockRunner = vi.fn().mockResolvedValue({ stdout: "", stderr: "" });
    const docker = {} as Parameters<typeof createTools>[0]["docker"];
    const tools = createTools({ docker, config: composeConfig(), composeRunner: mockRunner });

    await tools.docker_compose_down({ project: "myapp", volumes: true });

    expect(mockRunner).toHaveBeenCalledWith("/opt/myapp", ["down", "--volumes"], 15000);
  });

  test("is blocked in readOnly mode", async () => {
    const mockRunner = vi.fn();
    const docker = {} as Parameters<typeof createTools>[0]["docker"];
    const config: PluginConfig = { ...composeConfig(), readOnly: true };
    const tools = createTools({ docker, config, composeRunner: mockRunner });

    await expect(tools.docker_compose_down({ project: "myapp" })).rejects.toThrow(/readOnly/);
    expect(mockRunner).not.toHaveBeenCalled();
  });

  test("throws when project is unknown", async () => {
    const mockRunner = vi.fn();
    const docker = {} as Parameters<typeof createTools>[0]["docker"];
    const tools = createTools({ docker, config: composeConfig(), composeRunner: mockRunner });

    await expect(tools.docker_compose_down({ project: "gone" })).rejects.toThrow(/Unknown compose project/);
  });
});

// ──────────────────────────────────────────────────────────────────────────────
// T-007: docker_stats unit tests
// ──────────────────────────────────────────────────────────────────────────────

describe("docker_stats", () => {
  function makeStatsResponse(overrides: Record<string, unknown> = {}): Record<string, unknown> {
    return {
      cpu_stats: {
        cpu_usage: { total_usage: 200_000_000, percpu_usage: [100_000_000, 100_000_000] },
        system_cpu_usage: 1_000_000_000,
        online_cpus: 2
      },
      precpu_stats: {
        cpu_usage: { total_usage: 100_000_000 },
        system_cpu_usage: 500_000_000
      },
      memory_stats: {
        usage: 52_428_800, // 50 MiB
        limit: 1_073_741_824, // 1 GiB
        stats: { cache: 4_194_304 } // 4 MiB cache
      },
      networks: {
        eth0: { rx_bytes: 1024, tx_bytes: 2048 },
        eth1: { rx_bytes: 512, tx_bytes: 256 }
      },
      ...overrides
    };
  }

  test("returns CPU %, memory usage/limit, and network rx/tx", async () => {
    const mockStats = vi.fn().mockResolvedValue(makeStatsResponse());
    const docker = {
      getContainer: vi.fn().mockReturnValue({ stats: mockStats })
    } as unknown as Parameters<typeof createTools>[0]["docker"];

    const tools = createTools({ docker, config: baseConfig() });
    const result = (await tools.docker_stats({ containerId: "abc" })) as Record<string, unknown>;

    expect(mockStats).toHaveBeenCalledWith({ stream: false });
    expect(result.containerId).toBe("abc");
    expect(typeof result.cpuPercent).toBe("number");
    // cpuDelta=100M, systemDelta=500M, numCpus=2 → (100M/500M)*2*100 = 40%
    expect(result.cpuPercent).toBeCloseTo(40, 1);
    // memUsage = 52428800 - cache 4194304 = 48234496
    expect(result.memoryUsageBytes).toBe(48_234_496);
    expect(result.memoryLimitBytes).toBe(1_073_741_824);
    // network: eth0(rx=1024,tx=2048) + eth1(rx=512,tx=256)
    expect(result.networkRxBytes).toBe(1536);
    expect(result.networkTxBytes).toBe(2304);
  });

  test("is allowed in readOnly mode", async () => {
    const mockStats = vi.fn().mockResolvedValue(makeStatsResponse());
    const docker = {
      getContainer: vi.fn().mockReturnValue({ stats: mockStats })
    } as unknown as Parameters<typeof createTools>[0]["docker"];
    const config: PluginConfig = { ...baseConfig(), readOnly: true };
    const tools = createTools({ docker, config });

    // should not throw
    await expect(tools.docker_stats({ containerId: "abc" })).resolves.toBeDefined();
  });

  test("returns zero network bytes when no networks field", async () => {
    const statsData = makeStatsResponse({ networks: undefined });
    const docker = {
      getContainer: vi.fn().mockReturnValue({
        stats: vi.fn().mockResolvedValue(statsData)
      })
    } as unknown as Parameters<typeof createTools>[0]["docker"];

    const tools = createTools({ docker, config: baseConfig() });
    const result = (await tools.docker_stats({ containerId: "xyz" })) as Record<string, unknown>;

    expect(result.networkRxBytes).toBe(0);
    expect(result.networkTxBytes).toBe(0);
  });

  test("calls guard before container interaction", async () => {
    const docker = {
      getContainer: vi.fn().mockReturnValue({ stats: vi.fn() })
    } as unknown as Parameters<typeof createTools>[0]["docker"];
    const config: PluginConfig = { ...baseConfig(), allowedOperations: ["ps"] };
    const tools = createTools({ docker, config });

    await expect(tools.docker_stats({ containerId: "abc" })).rejects.toThrow(/allowedOperations/);
    expect((docker.getContainer as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });

  test("propagates Docker API errors", async () => {
    const docker = {
      getContainer: vi.fn().mockReturnValue({
        stats: vi.fn().mockRejectedValue(new Error("no such container"))
      })
    } as unknown as Parameters<typeof createTools>[0]["docker"];

    const tools = createTools({ docker, config: baseConfig() });
    await expect(tools.docker_stats({ containerId: "bad" })).rejects.toThrow(/no such container/);
  });

  test("stats is in READ_ONLY_ALLOWED guard list", () => {
    const config: PluginConfig = { ...baseConfig(), readOnly: true };
    expect(() => assertOperationAllowed("stats", config)).not.toThrow();
  });
});
