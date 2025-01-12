import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

export class MemoryClient {
  constructor(server) {
    this.server = server;
    this.entities = new Map();
    this.relations = [];
  }

  async createEntities(entities) {
    for (const entity of entities) {
      if (this.entities.has(entity.name)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Entity already exists: ${entity.name}`
        );
      }
      this.entities.set(entity.name, {
        name: entity.name,
        entityType: entity.entityType,
        observations: entity.observations || [],
      });
    }
  }

  async deleteEntities(entityNames) {
    for (const name of entityNames) {
      this.entities.delete(name);
      // Remove any relations involving this entity
      this.relations = this.relations.filter(
        (rel) => rel.from !== name && rel.to !== name
      );
    }
  }

  async createRelations(relations) {
    for (const relation of relations) {
      if (
        !this.entities.has(relation.from) ||
        !this.entities.has(relation.to)
      ) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Invalid relation: ${relation.from} -> ${relation.to}`
        );
      }
      this.relations.push({
        from: relation.from,
        to: relation.to,
        relationType: relation.relationType,
      });
    }
  }

  async deleteRelations(relations) {
    this.relations = this.relations.filter((existingRel) => {
      return !relations.some(
        (rel) =>
          rel.from === existingRel.from &&
          rel.to === existingRel.to &&
          rel.relationType === existingRel.relationType
      );
    });
  }

  async addObservations(observations) {
    for (const observation of observations) {
      const entity = this.entities.get(observation.entityName);
      if (!entity) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Entity not found: ${observation.entityName}`
        );
      }
      entity.observations.push(...observation.contents);
    }
  }
}
