import { Redirect } from 'expo-router';
import { snapshot } from '../lib/snapshot';

export default function Index() {
  // The exported app is the Explorer of the one project it carries
  return <Redirect href={snapshot ? '/explorer' : '/feed'} />;
}
