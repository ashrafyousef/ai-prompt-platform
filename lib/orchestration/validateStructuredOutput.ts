import { z } from "zod";
import Ajv, { ErrorObject } from "ajv";

export function validateStructuredOutput(
  output: string,
  outputFormat: "markdown" | "json" | "template",
  outputSchema: unknown
): { ok: boolean; parsed?: unknown; repairedOutput?: string } {
  if (outputFormat !== "json" || !outputSchema) {
    return { ok: true };
  }

  try {
    const parsed = JSON.parse(output);
    z.object({}).passthrough().parse(parsed);

    if (typeof outputSchema === "object" && outputSchema !== null) {
      const ajv = new Ajv({ allErrors: true, strict: false });
      const validate = ajv.compile(outputSchema as object);
      const valid = validate(parsed);
      if (!valid) {
        return {
          ok: false,
          repairedOutput: JSON.stringify(
            {
              error: "Model returned JSON that does not match required schema.",
              schemaErrors: formatSchemaErrors(validate.errors),
              raw: parsed,
            },
            null,
            2
          ),
        };
      }
    }

    return { ok: true, parsed };
  } catch {
    return {
      ok: false,
      repairedOutput: JSON.stringify(
        {
          error: "Model returned invalid JSON for structured mode.",
          raw: output,
        },
        null,
        2
      ),
    };
  }
}

function formatSchemaErrors(errors: ErrorObject[] | null | undefined): string[] {
  if (!errors || errors.length === 0) return [];
  return errors.map((error) => {
    const path = error.instancePath || "/";
    return `${path} ${error.message ?? "is invalid"}`;
  });
}
