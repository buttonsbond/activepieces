import { hubspotAuth } from '../../';
import { createAction, Property } from '@activepieces/pieces-framework';
import { Client } from '@hubspot/api-client';
import { OBJECT_TYPE } from '../common/constants';
import {
	additionalPropertiesToRetriveDropdown,
	getDefaultPropertiesForObject,
	objectPropertiesDropdown,
	pipelineDropdown,
	pipelineStageDropdown,
} from '../common/props';
import { MarkdownVariant } from '@activepieces/shared';

export const createTicketAction = createAction({
	auth: hubspotAuth,
	name: 'create-ticket',
	displayName: 'Create Ticket',
	description: 'Creates a ticket in HubSpot.',
	props: {
		ticketName: Property.ShortText({
			displayName: 'Ticket Name',
			description: 'The name of the ticket to create.',
			required: true,
		}),
		pipelineId: pipelineDropdown({
			objectType: OBJECT_TYPE.TICKET,
			displayName: 'Ticket Pipeline',
			required: true,
		}),
		pipelineStageId: pipelineStageDropdown({
			objectType: OBJECT_TYPE.TICKET,
			displayName: 'Ticket Pipeline Stage',
			required: true,
		}),
		objectProperites: objectPropertiesDropdown(OBJECT_TYPE.TICKET, [
			'subject',
			'hs_pipeline',
			'hs_pipeline_stage',
		]),
		markdown: Property.MarkDown({
			variant: MarkdownVariant.INFO,
			value: `### Properties to retrieve:
            
            subject, content, source_type, createdate, hs_pipeline, hs_pipeline_stage, hs_resolution, hs_ticket_category, hs_ticket_id, hs_ticket_priority, hs_lastmodifieddate, hubspot_owner_id, hubspot_team_id
            
            **Specify here a list of additional properties to retrieve**`,
		}),
		additionalPropertiesToRetrieve: additionalPropertiesToRetriveDropdown({
			objectType: OBJECT_TYPE.TICKET,
			displayName: 'Additional properties to retrieve',
			required: false,
		}),
	},
	async run(context) {
		const {
			ticketName,
			pipelineId,
			pipelineStageId,
			objectProperites = {},
			additionalPropertiesToRetrieve = [],
		} = context.propsValue;

		const ticketProperties: Record<string, string> = {
			subject: ticketName,
			hs_pipeline: pipelineId!,
			hs_pipeline_stage: pipelineStageId!,
		};

		// Add additional properties to the ticketProperties object
		Object.entries(objectProperites).forEach(([key, value]) => {
			// Format values if they are arrays
			ticketProperties[key] = Array.isArray(value) ? value.join(';') : value;
		});

		const client = new Client({ accessToken: context.auth.access_token });

		const createdTicket = await client.crm.tickets.basicApi.create({
			properties: ticketProperties,
		});

		// Retrieve default properties for the ticket and merge with additional properties to retrieve
		const defaultTicketProperties = getDefaultPropertiesForObject(OBJECT_TYPE.TICKET);

		const ticketDetails = await client.crm.tickets.basicApi.getById(createdTicket.id, [
			...defaultTicketProperties,
			...additionalPropertiesToRetrieve,
		]);

		return ticketDetails;
	},
});
