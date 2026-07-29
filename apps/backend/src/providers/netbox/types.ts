/**
 * The slice of the NetBox REST API that NetDash reads.
 *
 * Deliberately partial: only the fields the topology needs are declared, so a
 * NetBox upgrade that adds fields cannot break the mapping. Every field that is
 * optional here really can be absent in practice (a device with no primary IP,
 * a cable with no label, an interface with no VLAN, ...).
 */

export interface NetBoxRef {
  id: number;
  name?: string;
  display?: string;
  slug?: string;
}

export interface NetBoxChoice {
  value: string;
  label: string;
}

export interface NetBoxDevice {
  id: number;
  name: string | null;
  display: string;
  role: NetBoxRef | null;
  device_type: (NetBoxRef & { model?: string; manufacturer?: NetBoxRef }) | null;
  site: NetBoxRef | null;
  rack: NetBoxRef | null;
  tenant: NetBoxRef | null;
  cluster: NetBoxRef | null;
  serial?: string;
  status: NetBoxChoice;
  description?: string;
  comments?: string;
  primary_ip4?: { id: number; address: string } | null;
}

export interface NetBoxVirtualMachine {
  id: number;
  name: string;
  status: NetBoxChoice;
  cluster: NetBoxRef | null;
  tenant: NetBoxRef | null;
  vcpus?: number | null;
  memory?: number | null;
  disk?: number | null;
  description?: string;
  primary_ip4?: { id: number; address: string } | null;
}

export interface NetBoxCluster {
  id: number;
  name: string;
  type?: NetBoxRef | null;
}

export interface NetBoxInterface {
  id: number;
  name: string;
  device: NetBoxRef;
  type?: NetBoxChoice;
  description?: string;
  untagged_vlan?: (NetBoxRef & { vid?: number }) | null;
  tagged_vlans?: (NetBoxRef & { vid?: number })[];
  primary_mac_address?: { mac_address: string } | null;
}

export interface NetBoxCableTermination {
  object_type: string;
  object_id: number;
  object?: {
    id: number;
    name?: string;
    device?: NetBoxRef;
  };
}

export interface NetBoxCable {
  id: number;
  label?: string;
  status: NetBoxChoice;
  type?: string | null;
  a_terminations: NetBoxCableTermination[];
  b_terminations: NetBoxCableTermination[];
}

export interface NetBoxIpAddress {
  id: number;
  address: string;
  dns_name?: string;
  description?: string;
  assigned_object_type?: string | null;
  assigned_object_id?: number | null;
}

/** Everything the mapper needs, fetched once per refresh. */
export interface NetBoxDataset {
  devices: NetBoxDevice[];
  virtualMachines: NetBoxVirtualMachine[];
  clusters: NetBoxCluster[];
  interfaces: NetBoxInterface[];
  cables: NetBoxCable[];
  ipAddresses: NetBoxIpAddress[];
}
